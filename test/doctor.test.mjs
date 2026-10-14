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
  for (const dir of [home, bin, huddleHome]) fs.mkdirSync(dir, { recursive: true });
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
    };
    return new Promise((resolve) => {
      execFile(process.execPath, [CLI, 'doctor'], { env }, (error, stdout, stderr) =>
        resolve({ code: error ? error.code : 0, stdout, stderr }),
      );
    });
  };
  return { root, home, bin, huddleHome, stub, installSkills, run, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
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
  assert.match(stdout, /! Codex: skills not installed at .*\.agents\/skills; run: curl -fsSL https:\/\/agent-huddle\.vercel\.app\/install\.sh \| bash/);
  t.cleanup();
});

test('doctor: detects by directory signal without a binary', async () => {
  const t = makeEnv();
  fs.mkdirSync(path.join(t.home, '.config', 'opencode'), { recursive: true });
  const { stdout } = await t.run();
  assert.match(stdout, /! opencode: skills not installed at .*opencode\/skills/);
  t.cleanup();
});

test('doctor: agents that are not found say so', async () => {
  const t = makeEnv();
  const { stdout } = await t.run();
  assert.match(stdout, /- Claude Code: not found/);
  assert.match(stdout, /- Codex: not found/);
  assert.match(stdout, /- Antigravity: not found/);
  assert.match(stdout, /- Gemini CLI: not found/);
  assert.match(stdout, /- opencode: not found/);
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
  assert.match(stdout, /! Claude Code: skills not installed at .*\.claude-work\/skills/);
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
  assert.match(out, /! Claude Code: skills not installed at .*\.claude-old\/skills/);
  assert.doesNotMatch(out, /\.claude-old has no sessions/);
  t.cleanup();
});

test('doctor: Codex network hint appears unless network_access = true is set', async () => {
  const t = makeEnv();
  t.stub('codex');
  let out = (await t.run()).stdout;
  assert.match(out, /! Codex: localhost may be blocked/);
  fs.mkdirSync(path.join(t.home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(t.home, '.codex', 'config.toml'), '[sandbox_workspace_write]\nnetwork_access = true\n');
  out = (await t.run()).stdout;
  assert.doesNotMatch(out, /localhost may be blocked/);
  assert.doesNotMatch(out, /network_access = true\n/);
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
