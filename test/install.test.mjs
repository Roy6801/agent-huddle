import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync,
  statSync, lstatSync, writeFileSync, chmodSync, symlinkSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SKILLS, SKILL_FILES, applyDirs, applyPlan, applySaved, buildPlan, customRow, detect, expandPath, loadSaved, nextSteps,
  pathError, planLines, saveTargets, stageSkills, uninstallPlan,
} from '../src/install/core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function tmp() {
  return mkdtempSync(join(tmpdir(), 'huddle-install-'));
}

// A bin dir with node plus stub binaries for the named agents, so detection only sees these.
function makeBin(agents = []) {
  const bin = tmp();
  symlinkSync(process.execPath, join(bin, 'node'));
  for (const a of agents) {
    writeFileSync(join(bin, a), '#!/bin/sh\nexit 0\n');
    chmodSync(join(bin, a), 0o755);
  }
  return bin;
}

function envFor(home, { agents = [], env = {} } = {}) {
  return { HOME: home, PATH: `${makeBin(agents)}:/usr/bin:/bin`, AGENT_HUDDLE_NO_TTY: '1', ...env };
}

function mkdirs(home, ...dirs) {
  for (const d of dirs) mkdirSync(join(home, d), { recursive: true });
}

function touch(home, file, text = '{}') {
  mkdirSync(dirname(join(home, file)), { recursive: true });
  writeFileSync(join(home, file), text);
}

// A Claude Code config dir that has been used: settings.json and projects/.
function claudeDir(home, name) {
  touch(home, `${name}/settings.json`);
  mkdirs(home, `${name}/projects`);
}

function assertLinked(home, dir) {
  for (const n of SKILLS) assert.equal(readlinkSync(join(dir, n)), join(home, '.agents', 'skills', n), `${dir}/${n}`);
}

function saved(home) {
  return JSON.parse(readFileSync(join(home, '.agent-huddle', 'install.json'), 'utf8'));
}

function targets(home) {
  return saved(home).targets.map(({ agent, path, custom }) => `${agent} ${path} ${custom}`).sort();
}

const summary = (rows) => rows.map((r) => `${r.agent} ${r.selected ? 'x' : '-'} ${r.path}`);

// A source dir like a clone: install.sh, install.mjs and skills/.
function makeSource({ withInstaller = true } = {}) {
  const src = tmp();
  const files = withInstaller ? ['install.sh', 'install.mjs', ...SKILL_FILES.map((f) => join('skills', f))] : ['install.sh'];
  for (const f of files) {
    mkdirSync(dirname(join(src, f)), { recursive: true });
    copyFileSync(join(root, f), join(src, f));
  }
  chmodSync(join(src, 'install.sh'), 0o755);
  return src;
}

function run(src, home, { args = [], agents = [], path, env = {}, script = 'install.mjs' } = {}) {
  const base = envFor(home, { agents, env });
  if (path) base.PATH = path;
  const cmd = script === 'install.sh' ? ['bash', [join(src, 'install.sh'), ...args]] : [process.execPath, [join(src, 'install.mjs'), ...args]];
  return spawnSync(cmd[0], cmd[1], { env: base, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
}

function runAsync(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

// Serves install.mjs and skills/ from the repo; `missing` paths answer 404.
async function serve(missing = []) {
  const server = http.createServer((req, res) => {
    const file = join(root, decodeURIComponent(req.url));
    if (missing.includes(req.url) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

// core.mjs

test('detect lists every Claude config dir once and preselects only dirs with sessions', () => {
  const home = tmp();
  claudeDir(home, '.claude');
  claudeDir(home, '.claude-work');
  touch(home, '.claude-idle/settings.json');
  mkdirs(home, '.claude-old');
  symlinkSync(join(home, '.claude-work'), join(home, '.claude-alias'));
  const env = envFor(home, { env: { CLAUDE_CONFIG_DIR: join(home, '.claude-alias') } });
  const rows = detect(env).filter((r) => r.agent === 'claude');
  assert.deepEqual(summary(rows), [
    `claude x ${join(home, '.claude-alias', 'skills')}`,
    `claude x ${join(home, '.claude', 'skills')}`,
    `claude - ${join(home, '.claude-idle', 'skills')}`,
  ]);
  assert.equal(rows[2].idle, true);
  assert.match(rows[2].detail, /~\/\.claude-idle \(has settings\.json, no sessions here\)/);
  assert.match(rows[0].detail, /\(CLAUDE_CONFIG_DIR\)/);
});

test('detect: an unused ~/.claude is listed unchecked; CLAUDE_CONFIG_DIR is always checked', () => {
  const home = tmp();
  mkdirs(home, '.claude', '.claude-personal');
  touch(home, '.claude-personal/settings.json');
  const unused = detect(envFor(home)).filter((r) => r.agent === 'claude');
  assert.deepEqual(summary(unused), [
    `claude - ${join(home, '.claude', 'skills')}`,
    `claude - ${join(home, '.claude-personal', 'skills')}`,
  ]);
  assert.ok(unused.every((r) => r.found && r.idle));

  const pinned = detect(envFor(home, { env: { CLAUDE_CONFIG_DIR: join(home, '.claude-personal') } }));
  assert.deepEqual(summary(pinned.filter((r) => r.agent === 'claude')), [
    `claude x ${join(home, '.claude-personal', 'skills')}`,
    `claude - ${join(home, '.claude', 'skills')}`,
  ]);
});

test('detect: claude on PATH without a config dir, nothing at all, and the other agents', () => {
  const home = tmp();
  touch(home, '.gemini/settings.json');
  const rows = detect(envFor(home, { agents: ['claude', 'opencode'] }));
  assert.deepEqual(summary(rows), [
    `claude x ${join(home, '.claude', 'skills')}`,
    `codex x ${join(home, '.agents', 'skills')}`,
    `agy - ${join(home, '.gemini', 'antigravity-cli', 'skills')}`,
    `gemini x ${join(home, '.gemini', 'skills')}`,
    `opencode x ${join(home, '.config', 'opencode', 'skills')}`,
  ]);
  assert.equal(rows[0].detail, '~/.claude (claude on PATH)');
  assert.equal(rows[1].shared, true);
  assert.equal(rows[1].found, false);
  assert.equal(rows[3].detail, '~/.gemini/settings.json');
  assert.equal(rows[4].detail, 'opencode on PATH');

  const custom = tmp();
  claudeDir(custom, '.claude-work');
  const withCustom = detect(envFor(custom, { agents: ['claude'] }));
  assert.deepEqual(summary(withCustom.filter((r) => r.agent === 'claude')), [
    `claude x ${join(custom, '.claude-work', 'skills')}`,
  ]);

  const none = detect(envFor(tmp()));
  assert.equal(none[0].found, false);
  assert.equal(none[0].selected, false);
  assert.match(none[0].detail, /^not found \(no claude on PATH, no ~\/\.claude\)$/);
});

test('saved targets win; detected agents not in them are new and unchecked', () => {
  const home = tmp();
  claudeDir(home, '.claude');
  mkdirs(home, '.config/opencode', '.claude-idle');
  touch(home, '.claude-idle/settings.json');
  const env = envFor(home);
  const rows = applySaved(detect(env), [
    { agent: 'claude', path: join(home, 'work', 'skills'), custom: true },
    { agent: 'codex', path: join(home, '.agents', 'skills'), custom: false },
    { agent: 'gemini', path: join(home, 'g', 'skills'), custom: true },
  ], env);
  assert.deepEqual(summary(rows), [
    `claude - ${join(home, '.claude', 'skills')}`,
    `claude - ${join(home, '.claude-idle', 'skills')}`,
    `codex x ${join(home, '.agents', 'skills')}`,
    `agy - ${join(home, '.gemini', 'antigravity-cli', 'skills')}`,
    `gemini x ${join(home, 'g', 'skills')}`,
    `opencode - ${join(home, '.config', 'opencode', 'skills')}`,
    `claude x ${join(home, 'work', 'skills')}`,
  ]);
  const isNew = rows.filter((r) => r.isNew).map((r) => r.path);
  assert.deepEqual(isNew, [join(home, '.claude', 'skills'), join(home, '.config', 'opencode', 'skills')]);
  assert.equal(rows[6].custom, true);
  assert.equal(rows[6].added, true);
});

test('loadSaved skips invalid targets and maps unknown agents to other', () => {
  const home = tmp();
  const env = envFor(home);
  assert.equal(loadSaved(env), null);
  touch(home, '.agent-huddle/install.json', JSON.stringify({
    targets: [{ agent: 'cursor', path: '/x/skills' }, { agent: 'claude', path: 'relative' }, null, { agent: 'gemini', path: '/g', custom: 1 }],
  }));
  assert.deepEqual(loadSaved(env), [
    { agent: 'other', path: '/x/skills', custom: false },
    { agent: 'gemini', path: '/g', custom: true },
  ]);
  touch(home, '.agent-huddle/install.json', '{nope');
  assert.throws(() => loadSaved(env));
});

test('expandPath handles ~, $VAR and ${VAR} and rejects unset variables', () => {
  const env = { HOME: '/h', WORK: '/w' };
  assert.equal(expandPath('~', env), '/h');
  assert.equal(expandPath(' ~/a/skills ', env), '/h/a/skills');
  assert.equal(expandPath('$WORK/s', env), '/w/s');
  assert.equal(expandPath('${HOME}/x', env), '/h/x');
  assert.throws(() => expandPath('$NOPE/x', env), /\$NOPE is not set/);
});

test('pathError refuses files, the shared copy, duplicates and read-only parents', () => {
  const home = tmp();
  claudeDir(home, '.claude');
  touch(home, 'afile');
  mkdirs(home, 'locked');
  chmodSync(join(home, 'locked'), 0o555);
  const env = envFor(home);
  const rows = detect(env);
  assert.equal(pathError(rows, join(home, 'afile'), -1, env), '~/afile is a file');
  assert.equal(pathError(rows, join(home, '.agents', 'skills'), -1, env), 'that is the shared copy itself');
  assert.equal(pathError(rows, join(home, '.claude', 'skills'), -1, env), 'already listed for Claude Code');
  assert.equal(pathError(rows, join(home, '.claude', 'skills'), 0, env), '');
  assert.equal(pathError(rows, join(home, 'locked', 'a', 'skills'), -1, env), '~/locked is not writable');
  assert.equal(pathError(rows, join(home, 'new', 'skills'), -1, env), '');
  chmodSync(join(home, 'locked'), 0o755);
});

test('applyDirs sets exactly the given targets and rejects bad specs', () => {
  const home = tmp();
  claudeDir(home, '.claude');
  touch(home, '.gemini/settings.json');
  touch(home, 'afile');
  const env = envFor(home, { agents: ['opencode'] });
  const rows = detect(env);
  const warnings = applyDirs(rows, ['gemini', 'other=~/custom/skills', 'claude=$HOME/work/skills', 'codex'], env);
  assert.deepEqual(warnings, ['~/work has no settings.json; it may not be a Claude Code config dir']);
  assert.deepEqual(rows.filter((r) => r.selected).map((r) => `${r.agent} ${r.path} ${r.custom}`), [
    `codex ${join(home, '.agents', 'skills')} false`,
    `gemini ${join(home, '.gemini', 'skills')} false`,
    `other ${join(home, 'custom', 'skills')} true`,
    `claude ${join(home, 'work', 'skills')} true`,
  ]);
  assert.ok(nextSteps(rows).some((l) => l.startsWith('Codex: $huddle-start')));

  for (const [spec, msg] of [
    ['cursor', /unknown agent 'cursor'/],
    ['other', /other needs a path/],
    ['other=~/afile', /~\/afile is a file/],
    ['other=~/.agents/skills', /that is the shared copy itself/],
    ['codex=~/x', /Codex reads the shared copy/],
    ['other=$NOPE_UNSET/x', /could not expand '.*' \(\$NOPE_UNSET is not set\)/],
  ]) {
    assert.throws(() => applyDirs(detect(env), [spec], env), msg, spec);
  }
});

test('buildPlan links, creates, keeps, replaces and backs up, and writes nothing', () => {
  const home = tmp();
  claudeDir(home, '.claude');
  claudeDir(home, '.claude-work');
  const skills = join(home, '.claude', 'skills');
  const shared = join(home, '.agents', 'skills');
  mkdirs(home, '.claude/skills/huddle-start');
  touch(home, '.claude/skills/huddle-start/old.txt', 'old');
  symlinkSync(join(home, 'elsewhere'), join(skills, 'huddle-end'));
  symlinkSync(join(shared, 'huddle-join'), join(skills, 'huddle-join'));
  const env = envFor(home);
  const rows = detect(env);
  rows.push(customRow('other', shared));
  const plan = buildPlan(rows, env, '20261014120000');

  const kinds = plan.actions.map((a) => `${a.kind} ${a.name ?? ''}`.trim());
  assert.deepEqual(kinds, [
    ...SKILLS.map((n) => `copy ${n}`),
    'link agent-huddle', 'backup huddle-start', 'unchanged huddle-join', 'link huddle-rooms', 'replace huddle-end',
    'create', ...SKILLS.map((n) => `link ${n}`),
    'unchanged',
  ]);
  assert.deepEqual(planLines(plan, env), [
    'copy 5 skills → ~/.agents/skills (shared copy)',
    'link 2 skills → ~/.claude/skills; 1 skill already linked',
    'backup ~/.claude/skills/huddle-start → huddle-start.bak-20261014120000, then link',
    `replace ~/.claude/skills/huddle-end (was → ${join(home, 'elsewhere')})`,
    'link 5 skills → ~/.claude-work/skills (create folder)',
    'unchanged ~/.agents/skills (same folder as the shared copy)',
  ]);
  assert.equal(existsSync(shared), false);
  assert.ok(existsSync(join(skills, 'huddle-start', 'old.txt')));
});

test('stageSkills copies from a clone or downloads every file, all or nothing', async () => {
  const local = await stageSkills({ sourceDir: root });
  assert.equal(local.from, join(root, 'skills'));
  for (const f of SKILL_FILES) assert.deepEqual(readFileSync(join(local.dir, f)), readFileSync(join(root, 'skills', f)), f);
  rmSync(local.dir, { recursive: true });

  const server = await serve();
  try {
    const remote = await stageSkills({ sourceDir: tmp(), baseUrl: `${server.url}/` });
    assert.equal(remote.from, server.url);
    assert.equal(readFileSync(join(remote.dir, 'agent-huddle', 'huddle.mjs'), 'utf8'), readFileSync(join(root, 'skills', 'agent-huddle', 'huddle.mjs'), 'utf8'));
    rmSync(remote.dir, { recursive: true });
    await assert.rejects(
      stageSkills({ sourceDir: tmp(), baseUrl: `${server.url}/missing` }),
      /could not download http:\/\/127\.0\.0\.1:\d+\/missing\/skills\/agent-huddle\/SKILL\.md \(HTTP 404\)/,
    );
  } finally {
    server.close();
  }
});

test('applyPlan, saveTargets and uninstallPlan touch only our files', async () => {
  const home = tmp();
  claudeDir(home, '.claude');
  mkdirs(home, '.agents/skills/someone-else', '.claude/skills/mine');
  symlinkSync(join(home, 'elsewhere'), join(home, '.claude', 'skills', 'foreign'));
  const env = envFor(home);
  const rows = detect(env);
  const staged = await stageSkills({ sourceDir: root });
  applyPlan(buildPlan(rows, env), staged.dir);
  rmSync(staged.dir, { recursive: true });
  saveTargets(rows, env, new Date('2026-10-14T12:00:00.123Z'));
  assertLinked(home, join(home, '.claude', 'skills'));
  assert.ok(statSync(join(home, '.agents', 'skills', 'agent-huddle', 'huddle.mjs')).mode & 0o100);
  assert.equal(saved(home).installedAt, '2026-10-14T12:00:00Z');

  const removal = uninstallPlan(env);
  assert.deepEqual(removal.sort(), [
    ...SKILLS.map((n) => join(home, '.claude', 'skills', n)),
    ...SKILLS.map((n) => join(home, '.agents', 'skills', n)),
    join(home, '.agent-huddle', 'install.json'),
  ].sort());
});

// install.mjs and install.sh end to end

test('--yes first run installs the shared copy and links every detected agent in use', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  claudeDir(home, '.claude-work');
  touch(home, '.claude-idle/settings.json');
  mkdirs(home, '.claude-old');
  const r = run(src, home, { args: ['--yes'], agents: ['codex', 'opencode'] });
  assert.equal(r.status, 0, r.stderr);

  const base = join(home, '.agents', 'skills');
  const core = join(base, 'agent-huddle');
  assert.deepEqual(readdirSync(core).sort(), ['SKILL.md', 'huddle.mjs', 'page.html']);
  assert.ok(lstatSync(core).isDirectory() && !lstatSync(core).isSymbolicLink());
  assert.ok(statSync(join(core, 'huddle.mjs')).mode & 0o100, 'huddle.mjs is executable');
  for (const v of SKILLS.slice(1)) assert.deepEqual(readdirSync(join(base, v)), ['SKILL.md'], v);

  assertLinked(home, join(home, '.claude', 'skills'));
  assertLinked(home, join(home, '.claude-work', 'skills'));
  assertLinked(home, join(home, '.config', 'opencode', 'skills'));
  assert.equal(existsSync(join(home, '.claude-idle', 'skills')), false, 'no sessions, not preselected');
  assert.equal(existsSync(join(home, '.claude-old', 'skills')), false, 'no settings.json, not a config dir');
  assert.equal(existsSync(join(home, '.gemini')), false);

  assert.match(r.stdout, /✓ Claude Code\s+~\/\.claude \(folder exists\)/);
  assert.match(r.stdout, /✓ Claude Code\s+~\/\.claude-work \(has settings\.json\)/);
  assert.match(r.stdout, /✓ Claude Code\s+~\/\.claude-idle \(has settings\.json, no sessions here\)/);
  assert.match(r.stdout, /✓ Codex\s+codex on PATH/);
  assert.match(r.stdout, /- Antigravity\s+not found/);
  assert.match(r.stdout, /The shared copy ~\/\.agents\/skills is always installed \(Codex reads it directly\)\./);
  assert.match(r.stdout, /Plan:\n\s+copy 5 skills → ~\/\.agents\/skills \(shared copy\)/);
  assert.match(r.stdout, /link 5 skills → ~\/\.config\/opencode\/skills \(create folder\)/);
  assert.match(r.stdout, /Claude Code: \/huddle-start "my room"/);
  assert.match(r.stdout, /Codex: \$huddle-start/);
  assert.match(r.stdout, /\[sandbox_workspace_write\]\n\s+network_access = true/);
  assert.match(r.stdout, /opencode: ask "start a huddle"/);
  assert.match(r.stdout, /No skill in some agent\? Paste the invite that \/huddle-start prints instead\.\n$/);

  const j = saved(home);
  assert.deepEqual(Object.keys(j), ['version', 'shared', 'targets', 'installedAt']);
  assert.equal(j.version, 1);
  assert.equal(j.shared, base);
  assert.match(j.installedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual(targets(home), [
    `claude ${join(home, '.claude', 'skills')} false`,
    `claude ${join(home, '.claude-work', 'skills')} false`,
    `codex ${base} false`,
    `opencode ${join(home, '.config', 'opencode', 'skills')} false`,
  ].sort());
  assert.equal(statSync(join(home, '.agent-huddle')).mode & 0o777, 0o700);
  assert.equal(statSync(join(home, '.agent-huddle', 'install.json')).mode & 0o777, 0o600);
});

test('honours CLAUDE_CONFIG_DIR and AGENT_HUDDLE_HOME', () => {
  const src = makeSource();
  const home = tmp();
  const cfg = join(home, 'cfg');
  const state = join(home, 'state');
  const r = run(src, home, { args: ['--yes'], env: { CLAUDE_CONFIG_DIR: cfg, AGENT_HUDDLE_HOME: state } });
  assert.equal(r.status, 0, r.stderr);
  assertLinked(home, join(cfg, 'skills'));
  assert.equal(existsSync(join(home, '.claude')), false);
  assert.ok(existsSync(join(state, 'install.json')));
  assert.equal(existsSync(join(home, '.agent-huddle')), false);
});

test('Codex alone gets the shared copy with no links and no hints for missing agents', () => {
  const src = makeSource();
  const home = tmp();
  const r = run(src, home, { args: ['--yes'] });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(home, '.agents', 'skills', 'agent-huddle', 'huddle.mjs')));
  assert.equal(existsSync(join(home, '.claude')), false);
  assert.doesNotMatch(r.stdout, /Claude Code: |Codex: |link /);
  assert.deepEqual(targets(home), [`codex ${join(home, '.agents', 'skills')} false`]);
});

test('--dir installs exactly the given targets, expanding ~ and $VARS', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  touch(home, '.gemini/settings.json');
  const r = run(src, home, {
    args: ['--dir', 'gemini', '--dir=other=~/custom/skills', '--dir', 'claude=$HOME/work/skills'],
    agents: ['opencode'],
  });
  assert.equal(r.status, 0, r.stderr);
  assertLinked(home, join(home, '.gemini', 'skills'));
  assertLinked(home, join(home, 'custom', 'skills'));
  assertLinked(home, join(home, 'work', 'skills'));
  assert.equal(existsSync(join(home, '.claude', 'skills')), false);
  assert.equal(existsSync(join(home, '.config')), false);
  assert.match(r.stdout, /! ~\/work has no settings\.json; it may not be a Claude Code config dir/);
  assert.match(r.stdout, /Gemini CLI, Other: ask "start a huddle"/);
  assert.deepEqual(targets(home), [
    `claude ${join(home, 'work', 'skills')} true`,
    `codex ${join(home, '.agents', 'skills')} false`,
    `gemini ${join(home, '.gemini', 'skills')} false`,
    `other ${join(home, 'custom', 'skills')} true`,
  ]);
});

test('--dir rejects bad specs before writing', () => {
  const src = makeSource();
  const home = tmp();
  touch(home, 'afile');
  for (const [spec, msg] of [
    ['cursor', /unknown agent 'cursor'/],
    ['other=~/afile', /~\/afile is a file/],
    ['codex=~/x', /Codex reads the shared copy/],
  ]) {
    const r = run(src, home, { args: ['--dir', spec] });
    assert.equal(r.status, 1, spec);
    assert.match(r.stderr, msg, spec);
    assert.equal(existsSync(join(home, '.agents')), false, spec);
  }
});

test('without a terminal and without --yes it prints the plan and writes nothing', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  const r = run(src, home);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /link 5 skills → ~\/\.claude\/skills \(create folder\)/);
  assert.match(r.stdout, /Nothing installed\. Rerun with --yes to install this plan, or --dir agent\[=path\] to choose\.\n$/);
  assert.deepEqual(readdirSync(home), ['.claude']);

  const agent = run(src, home, { env: { AI_AGENT: 'codex' } });
  assert.equal(agent.status, 0, agent.stderr);
  assert.match(agent.stdout, /Running inside codex: ask your user which agents to install for before rerunning\./);
  assert.deepEqual(readdirSync(home), ['.claude']);

  const dry = run(src, home, { args: ['--dry-run', '--dir', 'other=~/x'] });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /link 5 skills → ~\/x \(create folder\)\n\nDry run; nothing installed\./);
  assert.deepEqual(readdirSync(home), ['.claude']);
});

test('plan backs up a real dir and replaces a foreign link, both shown before writing', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  const skills = join(home, '.claude', 'skills');
  mkdirSync(join(skills, 'huddle-start'), { recursive: true });
  writeFileSync(join(skills, 'huddle-start', 'old.txt'), 'old');
  symlinkSync(join(home, 'elsewhere'), join(skills, 'huddle-end'));

  const dry = run(src, home, { args: ['--dry-run'] });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /backup ~\/\.claude\/skills\/huddle-start → huddle-start\.bak-\d{14}, then link/);
  assert.match(dry.stdout, /replace ~\/\.claude\/skills\/huddle-end \(was → .*elsewhere\)/);
  assert.ok(existsSync(join(skills, 'huddle-start', 'old.txt')));

  const r = run(src, home, { args: ['--yes'] });
  assert.equal(r.status, 0, r.stderr);
  assertLinked(home, skills);
  const backups = readdirSync(skills).filter((n) => n.startsWith('huddle-start.bak-'));
  assert.equal(backups.length, 1);
  assert.ok(existsSync(join(skills, backups[0], 'old.txt')));
});

test('rerun with --yes keeps the saved targets', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  assert.equal(run(src, home, { args: ['--dir', 'claude=~/work/skills'] }).status, 0);
  const before = saved(home).targets;

  mkdirs(home, '.config/opencode');
  const dry = run(src, home, { args: ['--dry-run'] });
  assert.match(dry.stdout, /unchanged ~\/work\/skills \(5 skills already linked\)/);
  assert.doesNotMatch(dry.stdout, /link \d/);

  const yes = run(src, home, { args: ['--yes'] });
  assert.equal(yes.status, 0, yes.stderr);
  assert.equal(existsSync(join(home, '.claude', 'skills')), false);
  assert.equal(existsSync(join(home, '.config', 'opencode', 'skills')), false);
  assert.deepEqual(saved(home).targets, before);

  touch(home, '.agent-huddle/install.json', '{broken');
  const broken = run(src, home, { args: ['--dry-run'] });
  assert.match(broken.stdout, /! Could not read ~\/\.agent-huddle\/install\.json; using detected agents/);
});

test('--uninstall needs --yes without a terminal and removes only our files', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  mkdirs(home, '.agents/skills/someone-else', '.claude/skills/mine');
  symlinkSync(join(home, 'elsewhere'), join(home, '.claude', 'skills', 'foreign'));
  assert.equal(run(src, home, { args: ['--dir', 'claude', '--dir', 'other=~/x/skills'] }).status, 0);

  const ask = run(src, home, { args: ['--uninstall'] });
  assert.equal(ask.status, 0, ask.stderr);
  assert.match(ask.stdout, /Would remove:\n\s+~\/\.claude\/skills\/agent-huddle/);
  assert.match(ask.stdout, /Nothing removed\. Rerun with --uninstall --yes to remove these\./);
  assertLinked(home, join(home, 'x', 'skills'));

  const r = run(src, home, { args: ['--uninstall', '--yes'] });
  assert.equal(r.status, 0, r.stderr);
  for (const n of SKILLS) {
    assert.match(r.stdout, new RegExp(`✓ Removed ~/\\.claude/skills/${n}\\n`));
    assert.match(r.stdout, new RegExp(`✓ Removed ~/x/skills/${n}\\n`));
  }
  assert.match(r.stdout, /✓ Removed ~\/\.agent-huddle\/install\.json/);
  assert.deepEqual(readdirSync(join(home, '.claude', 'skills')).sort(), ['foreign', 'mine']);
  assert.deepEqual(readdirSync(join(home, 'x', 'skills')), []);
  assert.deepEqual(readdirSync(join(home, '.agents', 'skills')), ['someone-else']);

  const again = run(src, home, { args: ['--uninstall', '--yes'] });
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /Nothing to remove\./);
});

test('--help prints usage and unknown flags fail', () => {
  const src = makeSource();
  for (const script of ['install.mjs', 'install.sh']) {
    const help = run(src, tmp(), { args: ['--help'], script });
    assert.equal(help.status, 0, script);
    assert.match(help.stdout, /Usage: install\.sh/, script);
    assert.match(help.stdout, /--dry-run/, script);
    const bad = run(src, tmp(), { args: ['--interactive'], script });
    assert.equal(bad.status, 1, script);
    assert.match(bad.stderr, /unknown option: --interactive/, script);
  }
});

test('install.sh from a clone runs the install.mjs next to it', () => {
  const src = makeSource();
  const home = tmp();
  claudeDir(home, '.claude');
  const r = run(src, home, { args: ['--yes'], script: 'install.sh' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`✓ Skills staged from .*${src.split('/').pop()}/skills`));
  assertLinked(home, join(home, '.claude', 'skills'));
});

test('install.sh alone downloads install.mjs, which downloads the skills', async () => {
  const server = await serve();
  try {
    const src = makeSource({ withInstaller: false });
    const home = tmp();
    claudeDir(home, '.claude');
    const env = envFor(home, { env: { AGENT_HUDDLE_BASE_URL: server.url } });
    const r = await runAsync('bash', [join(src, 'install.sh'), '--yes'], env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`✓ Skills staged from ${server.url}\\n`));
    assertLinked(home, join(home, '.claude', 'skills'));
    assert.deepEqual(readdirSync(src), ['install.sh']);
  } finally {
    server.close();
  }
});

test('a failed download installs nothing', async () => {
  const server = await serve(['/skills/huddle-rooms/SKILL.md']);
  try {
    const dir = tmp();
    copyFileSync(join(root, 'install.mjs'), join(dir, 'install.mjs'));
    const home = tmp();
    claudeDir(home, '.claude');
    const env = envFor(home, { env: { AGENT_HUDDLE_BASE_URL: server.url } });
    const r = await runAsync(process.execPath, [join(dir, 'install.mjs'), '--yes'], env);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /could not download .*\/skills\/huddle-rooms\/SKILL\.md \(HTTP 404\)/);
    assert.deepEqual(readdirSync(home), ['.claude']);
    assert.deepEqual(readdirSync(join(home, '.claude')).sort(), ['projects', 'settings.json']);
  } finally {
    server.close();
  }
});

test('install.sh fails when node is missing', (t) => {
  const probe = spawnSync('/bin/sh', ['-c', 'command -v node'], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
  if (probe.status === 0) return t.skip('node is on /usr/bin:/bin');
  const r = run(makeSource(), tmp(), { args: ['--yes'], path: '/usr/bin:/bin', script: 'install.sh' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /agent-huddle needs Node\.js 20 or newer \(node not found\)/);
});

test('install.sh fails on Node older than 20.12', () => {
  for (const [version, msg] of [
    ['v18.19.0', /agent-huddle needs Node\.js 20 or newer \(found v18\.19\.0\)/],
    ['v20.5.1', /the agent-huddle installer needs Node\.js 20\.12 or newer \(found v20\.5\.1\)/],
  ]) {
    const bin = tmp();
    writeFileSync(join(bin, 'node'), `#!/bin/sh\necho ${version}\n`);
    chmodSync(join(bin, 'node'), 0o755);
    const home = tmp();
    const r = run(makeSource(), home, { args: ['--yes'], path: `${bin}:/usr/bin:/bin`, script: 'install.sh' });
    assert.equal(r.status, 1, version);
    assert.match(r.stderr, msg);
    assert.equal(existsSync(join(home, '.agents')), false);
  }
});

test('install.mjs is fresh: rebuilding from src/install gives the same bytes', (t) => {
  const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
  if (!existsSync(esbuild)) return t.skip('esbuild is not installed; run ni to check install.mjs freshness');
  const script = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['build:installer'];
  const out = join(tmp(), 'install.mjs');
  const build = script.split(' && ')[0].replace('--outfile=install.mjs', `--outfile=${out}`);
  const r = spawnSync('/bin/sh', ['-c', build], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${dirname(esbuild)}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(readFileSync(out).equals(readFileSync(join(root, 'install.mjs'))), 'install.mjs is stale; run nr build:installer');
});
