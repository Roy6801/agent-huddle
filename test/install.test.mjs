import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync,
  statSync, lstatSync, writeFileSync, chmodSync, symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function tmp() {
  return mkdtempSync(join(tmpdir(), 'huddle-install-'));
}

const VERBS = ['huddle-start', 'huddle-join', 'huddle-rooms', 'huddle-end'];
const SKILLS = ['agent-huddle', ...VERBS];

// A source dir with install.sh and skills/<name>/... (real files, or stubs).
function makeSource() {
  const src = tmp();
  const files = [
    'install.sh',
    ...['SKILL.md', 'huddle.mjs', 'page.html'].map((f) => join('skills', 'agent-huddle', f)),
    ...VERBS.map((v) => join('skills', v, 'SKILL.md')),
  ];
  for (const f of files) {
    const from = join(root, f);
    mkdirSync(dirname(join(src, f)), { recursive: true });
    if (existsSync(from)) copyFileSync(from, join(src, f));
    else writeFileSync(join(src, f), `stub ${f}\n`);
  }
  chmodSync(join(src, 'install.sh'), 0o755);
  return src;
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

function run(src, home, { args = [], input, agents = [], path, env = {}, stdio } = {}) {
  const base = { HOME: home, PATH: path ?? `${makeBin(agents)}:/usr/bin:/bin`, AGENT_HUDDLE_NO_TTY: '1' };
  return spawnSync('bash', [join(src, 'install.sh'), ...args], {
    env: { ...base, ...env }, encoding: 'utf8', input, stdio, timeout: 30000,
  });
}

function mkdirs(home, ...dirs) {
  for (const d of dirs) mkdirSync(join(home, d), { recursive: true });
}

function touch(home, file) {
  mkdirSync(dirname(join(home, file)), { recursive: true });
  writeFileSync(join(home, file), '{}');
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

test('--yes first run installs the shared copy and links every detected agent', () => {
  const src = makeSource();
  const home = tmp();
  mkdirs(home, '.claude', '.claude-old');
  touch(home, '.claude-work/settings.json');
  const r = run(src, home, { args: ['--yes'], agents: ['codex', 'opencode'] });
  assert.equal(r.status, 0, r.stderr);

  const base = join(home, '.agents', 'skills');
  const core = join(base, 'agent-huddle');
  assert.deepEqual(readdirSync(core).sort(), ['SKILL.md', 'huddle.mjs', 'page.html']);
  assert.ok(lstatSync(core).isDirectory() && !lstatSync(core).isSymbolicLink());
  assert.ok(statSync(join(core, 'huddle.mjs')).mode & 0o100, 'huddle.mjs is executable');
  for (const v of VERBS) assert.deepEqual(readdirSync(join(base, v)), ['SKILL.md'], v);

  assertLinked(home, join(home, '.claude', 'skills'));
  assertLinked(home, join(home, '.claude-work', 'skills'));
  assertLinked(home, join(home, '.config', 'opencode', 'skills'));
  assert.equal(existsSync(join(home, '.claude-old', 'skills')), false, 'no settings.json, not a config dir');
  assert.equal(existsSync(join(home, '.gemini')), false);

  assert.match(r.stdout, /✓ Claude Code\s+~\/\.claude \(folder exists\)/);
  assert.match(r.stdout, /✓ Claude Code\s+~\/\.claude-work \(has settings\.json\)/);
  assert.match(r.stdout, /✓ Codex\s+codex on PATH/);
  assert.match(r.stdout, /- Antigravity\s+not found/);
  assert.match(r.stdout, /Plan:\n\s+copy\s+~\/\.agents\/skills\/agent-huddle/);
  assert.match(r.stdout, /link\s+~\/\.config\/opencode\/skills\/agent-huddle\s+\(create folder\)/);
  assert.match(r.stdout, /Claude Code: \/huddle-start "my room"/);
  assert.match(r.stdout, /Codex: \$huddle-start/);
  assert.match(r.stdout, /\[sandbox_workspace_write\]\n\s+network_access = true/);
  assert.match(r.stdout, /opencode: ask "start a huddle"/);
  assert.match(r.stdout, /No skill in some agent\? Paste the invite that \/huddle-start prints instead\.\n$/);
  assert.doesNotMatch(r.stdout, /No terminal/);

  const j = saved(home);
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

test('Codex alone gets the shared copy with no links and no Codex-less hints', () => {
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
  mkdirs(home, '.claude');
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
  assert.deepEqual(targets(home), [
    `claude ${join(home, 'work', 'skills')} true`,
    `codex ${join(home, '.agents', 'skills')} false`,
    `gemini ${join(home, '.gemini', 'skills')} false`,
    `other ${join(home, 'custom', 'skills')} true`,
  ]);
});

test('--dir rejects unknown agents, files and a path-less other before writing', () => {
  const src = makeSource();
  const home = tmp();
  touch(home, 'afile');
  for (const [spec, msg] of [
    ['cursor', /unknown agent 'cursor'/],
    ['other', /other needs a path/],
    ['other=~/afile', /~\/afile is a file/],
    ['codex=~/x', /Codex reads the shared copy/],
    ['other=$NOPE_UNSET/x', /could not expand/],
  ]) {
    const r = run(src, home, { args: ['--dir', spec] });
    assert.equal(r.status, 1, spec);
    assert.match(r.stderr, msg, spec);
    assert.equal(existsSync(join(home, '.agents')), false, spec);
  }
});

test('--interactive menu: toggle, edit, add, remove, then proceed', () => {
  const src = makeSource();
  const home = tmp();
  mkdirs(home, '.claude');
  touch(home, '.gemini/settings.json');
  touch(home, 'afile');
  // Rows: 1 claude [x], 2 codex [x], 3 agy [ ], 4 gemini [x], 5 opencode [ ]
  const input = [
    '2', // codex cannot be unchecked
    '3', // agy on
    '4', // gemini off
    'e 1', '~/afile', '~/.agents/skills', '~/alt/skills', 'n', '~/alt/skills', 'y', 'n', '~/alt/skills', 'y', '',
    'a', '6', '$HOME/one/skills', '',
    'a', '6', '~/two/skills', 'y',
    'd 6',
    'd 1',
    'x9',
    '',
    'y',
  ].join('\n') + '\n';
  const r = run(src, home, { args: ['--interactive'], input });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /1 \[x\] Claude Code\s+~\/\.claude\/skills  folder will be created/);
  assert.match(r.stdout, /2 \[x\] Codex\s+~\/\.agents\/skills  \(shared copy\)/);
  assert.match(r.stdout, /3 \[ \] Antigravity\s+~\/\.gemini\/antigravity-cli\/skills  not found, folder will be created/);
  assert.match(r.stdout, /Codex reads the shared copy; it is always installed\./);
  assert.match(r.stdout, /error: ~\/afile is a file/);
  assert.match(r.stdout, /error: that is the shared copy itself/);
  assert.match(r.stdout, /may not be a Claude Code config dir\. Use it anyway\? \[y\/N\]/);
  assert.match(r.stdout, /~\/alt\/skills does not exist\. Create it\? \[Y\/n\]/);
  assert.match(r.stdout, /1 \[x\] Claude Code\s+~\/alt\/skills  \(custom\), folder will be created/);
  assert.match(r.stdout, /Only rows added with a can be removed/);
  assert.match(r.stdout, /Unknown command/);

  assertLinked(home, join(home, 'alt', 'skills'));
  assertLinked(home, join(home, '.gemini', 'antigravity-cli', 'skills'));
  assertLinked(home, join(home, 'two', 'skills'));
  for (const gone of ['.claude/skills', '.gemini/skills', 'one']) assert.equal(existsSync(join(home, gone)), false, gone);
  assert.deepEqual(targets(home), [
    `agy ${join(home, '.gemini', 'antigravity-cli', 'skills')} false`,
    `claude ${join(home, 'alt', 'skills')} true`,
    `codex ${join(home, '.agents', 'skills')} false`,
    `other ${join(home, 'two', 'skills')} true`,
  ]);
  assert.match(r.stdout, /Antigravity, Other: ask "start a huddle"/);
});

test('q quits from the menu and a declined plan writes nothing', () => {
  const src = makeSource();
  for (const input of ['3\nq\n', '\nn\n']) {
    const home = tmp();
    mkdirs(home, '.claude');
    const r = run(src, home, { args: ['--interactive'], input });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Nothing changed\./);
    assert.deepEqual(readdirSync(home), ['.claude']);
    assert.deepEqual(readdirSync(join(home, '.claude')), []);
  }
});

test('input that ends early aborts without writing and never hangs', () => {
  const src = makeSource();
  const home = tmp();
  mkdirs(home, '.claude');
  const r = run(src, home, { args: ['--interactive'], stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Input ended; nothing changed\./);
  assert.deepEqual(readdirSync(home), ['.claude']);
});

test('without a terminal and without --yes it installs the defaults', () => {
  const src = makeSource();
  const home = tmp();
  mkdirs(home, '.claude');
  const r = run(src, home, { stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r.status, 0, r.stderr);
  assertLinked(home, join(home, '.claude', 'skills'));
  assert.match(r.stdout, /No terminal; installed to detected targets\. Rerun with --dir to choose\./);
  assert.doesNotMatch(r.stdout, /Proceed\?/);
});

test('plan backs up a real dir and replaces a foreign link, both shown before writing', () => {
  const src = makeSource();
  const home = tmp();
  const skills = join(home, '.claude', 'skills');
  mkdirSync(join(skills, 'huddle-start'), { recursive: true });
  writeFileSync(join(skills, 'huddle-start', 'old.txt'), 'old');
  symlinkSync(join(home, 'elsewhere'), join(skills, 'huddle-end'));

  const declined = run(src, home, { args: ['--interactive'], input: '\nn\n' });
  assert.equal(declined.status, 0, declined.stderr);
  assert.match(declined.stdout, /backup\s+~\/\.claude\/skills\/huddle-start\s+\(moved to huddle-start\.bak-\d{14}, then linked\)/);
  assert.match(declined.stdout, /replace\s+~\/\.claude\/skills\/huddle-end\s+\(was -> .*elsewhere\)/);
  assert.ok(existsSync(join(skills, 'huddle-start', 'old.txt')));

  const r = run(src, home, { args: ['--yes'] });
  assert.equal(r.status, 0, r.stderr);
  assertLinked(home, skills);
  const backups = readdirSync(skills).filter((n) => n.startsWith('huddle-start.bak-'));
  assert.equal(backups.length, 1);
  assert.ok(existsSync(join(skills, backups[0], 'old.txt')));
});

test('rerun uses the saved targets and offers newly detected agents unchecked', () => {
  const src = makeSource();
  const home = tmp();
  mkdirs(home, '.claude');
  assert.equal(run(src, home, { args: ['--dir', 'claude=~/work/skills'] }).status, 0);
  const before = readFileSync(join(home, '.agent-huddle', 'install.json'), 'utf8');

  mkdirs(home, '.config/opencode');
  const r = run(src, home, { args: ['--interactive'], input: '\ny\n' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[ \] Claude Code\s+~\/\.claude\/skills  new since last install/);
  assert.match(r.stdout, /\[x\] Claude Code\s+~\/work\/skills  \(custom\)\n/);
  assert.match(r.stdout, /\[ \] opencode\s+~\/\.config\/opencode\/skills  new since last install, folder will be created/);
  assert.equal((r.stdout.match(/unchanged /g) ?? []).length, 5);
  assert.doesNotMatch(r.stdout, /\blink /);
  assert.equal(existsSync(join(home, '.claude', 'skills')), false);
  assert.equal(existsSync(join(home, '.config', 'opencode', 'skills')), false);
  assert.deepEqual(JSON.parse(readFileSync(join(home, '.agent-huddle', 'install.json'), 'utf8')).targets, JSON.parse(before).targets);

  const yes = run(src, home, { args: ['--yes'] });
  assert.equal(yes.status, 0, yes.stderr);
  assert.equal(existsSync(join(home, '.claude', 'skills')), false, '--yes keeps the saved targets');
});

test('--uninstall removes only our links, the shared skills and install.json', () => {
  const src = makeSource();
  const home = tmp();
  mkdirs(home, '.claude', '.agents/skills/someone-else', '.claude/skills/mine');
  symlinkSync(join(home, 'elsewhere'), join(home, '.claude', 'skills', 'foreign'));
  assert.equal(run(src, home, { args: ['--dir', 'claude', '--dir', 'other=~/x/skills'] }).status, 0);

  const r = run(src, home, { args: ['--uninstall'] });
  assert.equal(r.status, 0, r.stderr);
  for (const n of SKILLS) {
    assert.match(r.stdout, new RegExp(`✓ Removed ~/\\.claude/skills/${n}\\n`));
    assert.match(r.stdout, new RegExp(`✓ Removed ~/x/skills/${n}\\n`));
  }
  assert.match(r.stdout, /✓ Removed ~\/\.agent-huddle\/install\.json/);
  assert.deepEqual(readdirSync(join(home, '.claude', 'skills')).sort(), ['foreign', 'mine']);
  assert.deepEqual(readdirSync(join(home, 'x', 'skills')), []);
  assert.deepEqual(readdirSync(join(home, '.agents', 'skills')), ['someone-else']);
  assert.equal(existsSync(join(home, '.agent-huddle', 'install.json')), false);

  const again = run(src, home, { args: ['--uninstall'] });
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /Nothing to remove\./);
});

test('--help prints usage and unknown flags fail', () => {
  const src = makeSource();
  const help = run(src, tmp(), { args: ['--help'] });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: install\.sh/);
  assert.match(help.stdout, /AGENT_HUDDLE_NO_TTY=1/);
  const bad = run(src, tmp(), { args: ['--nope'] });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown option: --nope/);
});

test('fails when node is missing', (t) => {
  const probe = spawnSync('/bin/sh', ['-c', 'command -v node'], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
  if (probe.status === 0) return t.skip('node is on /usr/bin:/bin');
  const r = run(makeSource(), tmp(), { args: ['--yes'], path: '/usr/bin:/bin' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /agent-huddle needs Node\.js 20 or newer \(node not found\)/);
});

test('fails on Node older than 20', () => {
  const bin = tmp();
  writeFileSync(join(bin, 'node'), '#!/bin/sh\necho v18.19.0\n');
  chmodSync(join(bin, 'node'), 0o755);
  const home = tmp();
  const r = run(makeSource(), home, { args: ['--yes'], path: `${bin}:/usr/bin:/bin` });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /agent-huddle needs Node\.js 20 or newer \(found v18\.19\.0\)/);
  assert.equal(existsSync(join(home, '.agents')), false);
});
