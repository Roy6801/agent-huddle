import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { diagnose } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;

test('EPERM and EACCES are reported as a sandbox block with the Codex fix', () => {
  for (const code of ['EPERM', 'EACCES']) {
    const result = diagnose({ message: 'fetch failed', cause: { code } });
    assert.equal(result.kind, 'sandbox');
    assert.ok(result.message.includes('[sandbox_workspace_write]'));
    assert.ok(result.message.includes('network_access = true'));
    assert.ok(result.message.includes('~/.codex/config.toml'));
    assert.ok(result.message.includes('restart Codex (or the headless worker)'));
    assert.ok(result.message.includes('a headless agent asks on the room page'));
  }
});

test('codes nested in AggregateError are found', () => {
  const err = { cause: { code: 'AggregateError', errors: [{ code: 'ECONNREFUSED' }, { code: 'EPERM' }] } };
  assert.equal(diagnose(err).kind, 'sandbox');
  const refused = { cause: { errors: [{ code: 'ECONNREFUSED' }, { code: 'ECONNREFUSED' }] } };
  assert.equal(diagnose(refused).kind, 'not-running');
});

test('ECONNREFUSED means the server is not running and suggests up', () => {
  const result = diagnose({ cause: { code: 'ECONNREFUSED' } });
  assert.equal(result.kind, 'not-running');
  assert.ok(result.message.startsWith('huddle server is not running; start it with: node '));
  assert.ok(result.message.endsWith('huddle.mjs up'));
});

test('anything else keeps the error text', () => {
  const result = diagnose(new Error('weird failure'));
  assert.equal(result.kind, 'other');
  assert.ok(result.message.includes('weird failure'));
});

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

test('doctor CLI exits 1 and mentions up when nothing is listening', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-doctor-'));
  const port = await freePort();
  const result = await new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, 'doctor'],
      { env: { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(port) } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
  assert.equal(result.code, 1);
  assert.match(result.stdout, /✓ Node/);
  assert.match(result.stdout, /✓ home/);
  assert.match(result.stdout, /✗ server/);
  assert.match(result.stdout, / up/);
  fs.rmSync(home, { recursive: true, force: true });
});

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-agents-'));
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  const huddleHome = path.join(root, 'state');
  const apps = path.join(root, 'Applications');
  for (const dir of [home, bin, huddleHome, apps]) fs.mkdirSync(dir, { recursive: true });
  const stub = (name) => {
    fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n', { mode: 0o755 });
  };
  const installSkills = (dir) => {
    for (const skill of ['agent-huddle', 'huddle-start', 'huddle-join', 'huddle-rooms', 'huddle-end']) {
      fs.mkdirSync(path.join(dir, skill), { recursive: true });
      fs.writeFileSync(path.join(dir, skill, 'SKILL.md'), '# skill\n');
    }
  };
  const run = async () => {
    const port = await freePort();
    const env = {
      PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`,
      HOME: home,
      AGENT_HUDDLE_HOME: huddleHome,
      AGENT_HUDDLE_PORT: String(port),
      AGENT_HUDDLE_APP_DIRS: apps,
    };
    return new Promise((resolve) => {
      execFile(process.execPath, [CLI, 'doctor'], { env }, (error, stdout, stderr) =>
        resolve({ code: error ? error.code : 0, stdout, stderr }),
      );
    });
  };
  return { root, home, bin, huddleHome, apps, stub, installSkills, run, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('doctor: found agent with skills installed prints a check', async () => {
  const t = makeEnv();
  t.stub('claude');
  fs.mkdirSync(path.join(t.home, '.claude', 'projects'), { recursive: true });
  t.installSkills(path.join(t.home, '.claude', 'skills'));
  const { stdout } = await t.run();
  assert.match(stdout, /✓ Claude Code: found, skills installed at .*\.claude\/skills/);
  t.cleanup();
});

test('doctor: found agent missing skills prints the install hint', async () => {
  const t = makeEnv();
  t.stub('codex');
  const { stdout } = await t.run();
  assert.match(stdout, /! Codex: found \(codex on PATH\), skills not installed at .*\.agents\/skills; run: curl -fsSL https:\/\/agent-huddle\.vercel\.app\/install\.sh \| bash/);
  t.cleanup();
});

test('AC-40.8: doctor says when Codex has not trusted the page-approvals hook, and only then', async () => {
  const t = makeEnv();
  t.stub('codex');
  const codexHome = path.join(t.home, '.codex');
  fs.mkdirSync(codexHome, { recursive: true });
  const hooks = path.join(codexHome, 'hooks.json');
  const command = `node "${CLI}" ask-hook codex`;
  fs.writeFileSync(hooks, JSON.stringify({ hooks: { PermissionRequest: [{ matcher: '.*', hooks: [{ type: 'command', command }] }] } }));
  assert.match((await t.run()).stdout, /! Codex: page approvals hook not trusted yet: run \/hooks in Codex once/);
  fs.writeFileSync(path.join(codexHome, 'config.toml'), `[hooks.state.${JSON.stringify(`${hooks}:permission_request:0:0`)}]\ntrusted_hash = "sha256:ab"\n`);
  assert.doesNotMatch((await t.run()).stdout, /not trusted/);
  fs.rmSync(hooks);
  assert.doesNotMatch((await t.run()).stdout, /not trusted/, 'no hook, nothing to trust');
  t.cleanup();
});

test('doctor: detects by directory signal without a binary', async () => {
  const t = makeEnv();
  fs.mkdirSync(path.join(t.home, '.config', 'opencode'), { recursive: true });
  const { stdout } = await t.run();
  assert.match(stdout, /! opencode: found \(~\/\.config\/opencode\), skills not installed at .*opencode\/skills/);
  t.cleanup();
});

test('doctor: agents that are not found say so', async () => {
  const t = makeEnv();
  const { stdout } = await t.run();
  assert.match(stdout, /- Claude Code: not found/);
  assert.match(stdout, /- Codex: not found/);
  assert.match(stdout, /- Antigravity CLI: not found/);
  assert.match(stdout, /- Antigravity app: not found/);
  assert.match(stdout, /- Gemini CLI: not found/);
  assert.match(stdout, /- opencode: not found/);
  assert.match(stdout, /- DeepSeek Harness: not found/);
  t.cleanup();
});

test('doctor: lists extra Claude config dirs and custom targets from install.json', async () => {
  const t = makeEnv();
  const work = path.join(t.home, '.claude-work');
  fs.mkdirSync(path.join(work, 'projects'), { recursive: true });
  fs.writeFileSync(path.join(work, 'settings.json'), '{}');
  const custom = path.join(t.root, 'elsewhere', 'skills');
  t.installSkills(custom);
  fs.writeFileSync(
    path.join(t.huddleHome, 'install.json'),
    JSON.stringify({ version: 1, targets: [{ agent: 'other', path: custom, custom: true }] }),
  );
  const { stdout } = await t.run();
  assert.match(stdout, /! Claude Code: found, skills not installed at .*\.claude-work\/skills/);
  assert.ok(stdout.includes(`✓ Other: found, skills installed at ${custom}`));
  t.cleanup();
});

test('doctor: skips Claude dirs without sessions unless they are saved targets', async () => {
  const t = makeEnv();
  const idle = path.join(t.home, '.claude-old');
  fs.mkdirSync(idle, { recursive: true });
  fs.writeFileSync(path.join(idle, 'settings.json'), '{}');
  fs.mkdirSync(path.join(t.home, '.claude'), { recursive: true });
  let out = (await t.run()).stdout;
  assert.ok(out.includes(`  - Claude Code: ${idle} has no sessions, skipped`));
  assert.ok(out.includes(`  - Claude Code: ${path.join(t.home, '.claude')} has no sessions, skipped`));
  assert.doesNotMatch(out, /! Claude Code/);

  fs.writeFileSync(
    path.join(t.huddleHome, 'install.json'),
    JSON.stringify({ version: 1, targets: [{ agent: 'claude', path: path.join(idle, 'skills'), custom: false }] }),
  );
  out = (await t.run()).stdout;
  assert.match(out, /! Claude Code: found, skills not installed at .*\.claude-old\/skills/);
  assert.doesNotMatch(out, /\.claude-old has no sessions/);
  t.cleanup();
});

test('doctor: Codex network hint appears unless network_access = true is set', async () => {
  const t = makeEnv();
  t.stub('codex');
  let out = (await t.run()).stdout;
  assert.match(out, /! Codex: localhost may be blocked; approve network access when asked \(on the room page for a headless agent\)/);
  fs.mkdirSync(path.join(t.home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(t.home, '.codex', 'config.toml'), '[sandbox_workspace_write]\nnetwork_access = true\n');
  out = (await t.run()).stdout;
  assert.doesNotMatch(out, /localhost may be blocked/);
  assert.doesNotMatch(out, /network_access = true\n/);
  t.cleanup();
});

test('doctor: warns that headless Claude Code and Codex need bunx until it is on PATH', async () => {
  const t = makeEnv();
  let out = (await t.run()).stdout;
  assert.doesNotMatch(out, /bunx/);
  t.stub('claude');
  t.stub('codex');
  out = (await t.run()).stdout;
  assert.match(out, /^! bunx: not found; headless Claude Code and Codex start their ACP adapters with it \(install Bun\)$/m);
  t.stub('bunx');
  out = (await t.run()).stdout;
  assert.doesNotMatch(out, /bunx/);
  t.cleanup();
});

test('doctor: corrupt install.json is ignored', async () => {
  const t = makeEnv();
  fs.writeFileSync(path.join(t.huddleHome, 'install.json'), '{not json');
  const { stdout, stderr } = await t.run();
  assert.match(stdout, /^Agents$/m);
  assert.equal(stderr, '');
  t.cleanup();
});

test('doctor: agent warnings do not change the exit code', async () => {
  const t = makeEnv();
  const plain = await t.run();
  t.stub('claude');
  t.stub('codex');
  const warned = await t.run();
  assert.match(warned.stdout, /! Claude Code/);
  assert.equal(warned.code, plain.code);
  t.cleanup();
});

test('doctor: Codex bundled in the ChatGPT app counts and says which variant was found', async () => {
  const t = makeEnv();
  const codex = path.join(t.apps, 'ChatGPT.app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex');
  fs.mkdirSync(path.dirname(codex), { recursive: true });
  fs.writeFileSync(codex, '#!/bin/sh\n', { mode: 0o755 });
  let out = (await t.run()).stdout;
  assert.match(out, /! Codex: found \(ChatGPT app\), skills not installed at .*\.agents\/skills/);
  t.stub('codex');
  out = (await t.run()).stdout;
  assert.match(out, /! Codex: found \(codex on PATH, ChatGPT app\)/);
  t.cleanup();
});

test('doctor: DeepSeek Harness reads the shared copy and shows its version without booting a profile', async () => {
  const t = makeEnv();
  const app = path.join(t.apps, 'DeepSeek Harness.app', 'Contents');
  const dsh = path.join(app, 'Resources', 'runtime', 'cli', 'bin', 'dsh');
  fs.mkdirSync(path.dirname(dsh), { recursive: true });
  const ran = path.join(t.root, 'ran');
  fs.writeFileSync(dsh, `#!/bin/sh\ntouch ${ran}\n`, { mode: 0o755 });
  fs.writeFileSync(
    path.join(app, 'Info.plist'),
    '<?xml version="1.0"?>\n<plist><dict>\n  <key>CFBundleShortVersionString</key>\n  <string>0.2.0-rc.2</string>\n</dict></plist>\n',
  );
  let out = (await t.run()).stdout;
  assert.match(out, /! DeepSeek Harness: found \(DeepSeek Harness app, version 0\.2\.0-rc\.2\), reads the shared copy at .*\.agents\/skills, which is missing skills/);
  assert.equal(fs.existsSync(ran), false, 'the app-bundled dsh is not run');
  t.installSkills(path.join(t.home, '.agents', 'skills'));
  out = (await t.run()).stdout;
  assert.match(out, /✓ DeepSeek Harness: found \(DeepSeek Harness app, version 0\.2\.0-rc\.2\), reads the shared copy at .*\.agents\/skills\n/);
  assert.match(out, /- Codex: not found/);
  t.cleanup();

  const cli = makeEnv();
  const args = path.join(cli.root, 'args');
  fs.writeFileSync(path.join(cli.bin, 'dsh'), `#!/bin/sh\necho "$@" > ${args}\necho 0.2.1-alpha.2\n`, { mode: 0o755 });
  out = (await cli.run()).stdout;
  assert.match(out, /DeepSeek Harness: found \(dsh on PATH, version 0\.2\.1-alpha\.2\)/);
  assert.equal(fs.readFileSync(args, 'utf8'), '--version\n');
  cli.cleanup();
});

test('doctor: Antigravity CLI and app are separate rows; ~/.gemini alone is neither', async () => {
  const t = makeEnv();
  fs.mkdirSync(path.join(t.home, '.gemini'), { recursive: true });
  let out = (await t.run()).stdout;
  assert.match(out, /- Antigravity CLI: not found/);
  assert.match(out, /- Antigravity app: not found/);
  assert.match(out, /- Gemini CLI: not found/);

  fs.mkdirSync(path.join(t.home, '.gemini', 'antigravity'), { recursive: true });
  out = (await t.run()).stdout;
  assert.match(out, /- Antigravity app: not found/, 'a leftover ~/.gemini/antigravity is not the app');

  fs.mkdirSync(path.join(t.apps, 'Antigravity.app'), { recursive: true });
  t.stub('agy');
  out = (await t.run()).stdout;
  assert.match(out, /! Antigravity CLI: found \(agy on PATH\), skills not installed at .*\.gemini\/antigravity-cli\/skills/);
  assert.match(out, /! Antigravity app: found \(Antigravity app\), skills not installed at .*\.gemini\/config\/skills/);
  t.cleanup();
});

test('doctor: with the Claude desktop app, ~/.claude is checked even without sessions', async () => {
  const t = makeEnv();
  fs.mkdirSync(path.join(t.home, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(t.apps, 'Claude.app'), { recursive: true });
  const out = (await t.run()).stdout;
  assert.match(
    out,
    /! Claude Code: found \(Claude desktop app reads it, whatever CLAUDE_CONFIG_DIR says\), skills not installed at .*\.claude\/skills/,
  );
  assert.doesNotMatch(out, /has no sessions, skipped/);
  t.cleanup();
});

test('doctor: without ~/.claude, the desktop app does not count it when another config dir exists', async () => {
  const t = makeEnv();
  fs.mkdirSync(path.join(t.apps, 'Claude.app'), { recursive: true });
  const work = path.join(t.home, '.claude-work');
  fs.mkdirSync(path.join(work, 'projects'), { recursive: true });
  fs.writeFileSync(path.join(work, 'settings.json'), '{}');
  const out = (await t.run()).stdout;
  assert.ok(
    out.includes(`  - Claude Code: ${path.join(t.home, '.claude')} not created yet (Claude desktop app reads it, whatever CLAUDE_CONFIG_DIR says), skipped`),
  );
  t.cleanup();
});

test('doctor: reports whether the agent-huddle command is on PATH', async () => {
  const t = makeEnv();
  assert.match((await t.run()).stdout, /! command: agent-huddle not on PATH \(reinstall, or add ~\/\.local\/bin to PATH\)/);
  t.stub('agent-huddle');
  assert.match((await t.run()).stdout, /✓ command: agent-huddle on PATH/);
  t.cleanup();
});
