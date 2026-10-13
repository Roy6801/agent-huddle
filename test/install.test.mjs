import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync,
  statSync, lstatSync, writeFileSync, chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodeDir = dirname(process.execPath);

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

function run(src, home, { path, env = {} } = {}) {
  const base = { HOME: home, PATH: path ?? `${nodeDir}:/usr/bin:/bin` };
  return spawnSync('bash', [join(src, 'install.sh')], { env: { ...base, ...env }, encoding: 'utf8' });
}

function snapshot(home, cfg) {
  const links = SKILLS.flatMap((n) => [
    join(cfg ?? join(home, '.claude'), 'skills', n),
    join(home, '.gemini', 'skills', n),
  ]).map((p) => [p, lstatSync(p, { throwIfNoEntry: false }) ? readlinkSync(p) : null]);
  const dirs = SKILLS.map((n) => [n, readdirSync(join(home, '.agents', 'skills', n)).sort()]);
  return JSON.stringify({ links, dirs });
}

test('installs all five skills and links them for Claude Code and Gemini', () => {
  const src = makeSource();
  const home = tmp();
  mkdirSync(join(home, '.gemini'));
  const r = run(src, home);
  assert.equal(r.status, 0, r.stderr);
  const base = join(home, '.agents', 'skills');
  const core = join(base, 'agent-huddle');
  assert.deepEqual(readdirSync(core).sort(), ['SKILL.md', 'huddle.mjs', 'page.html']);
  assert.ok(lstatSync(core).isDirectory() && !lstatSync(core).isSymbolicLink());
  assert.ok(statSync(join(core, 'huddle.mjs')).mode & 0o100, 'huddle.mjs is executable');
  for (const v of VERBS) assert.deepEqual(readdirSync(join(base, v)), ['SKILL.md'], v);
  for (const n of SKILLS) {
    assert.equal(readlinkSync(join(home, '.claude', 'skills', n)), join(base, n), n);
    assert.equal(readlinkSync(join(home, '.gemini', 'skills', n)), join(base, n), n);
  }
  assert.match(r.stdout, /\/huddle-start \(Claude Code\) or \$huddle-start \(Codex\)/);
  assert.match(r.stdout, /network_access = true/);
});

test('honours CLAUDE_CONFIG_DIR', () => {
  const src = makeSource();
  const home = tmp();
  const cfg = join(home, 'cfg');
  const r = run(src, home, { env: { CLAUDE_CONFIG_DIR: cfg } });
  assert.equal(r.status, 0, r.stderr);
  for (const n of SKILLS) {
    assert.equal(readlinkSync(join(cfg, 'skills', n)), join(home, '.agents', 'skills', n), n);
  }
  assert.equal(existsSync(join(home, '.claude')), false);
});

test('links into Gemini and Antigravity CLI folders when they exist', () => {
  const src = makeSource();
  const home = tmp();
  mkdirSync(join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  const r = run(src, home);
  assert.equal(r.status, 0, r.stderr);
  for (const n of SKILLS) {
    assert.equal(readlinkSync(join(home, '.gemini', 'antigravity-cli', 'skills', n)), join(home, '.agents', 'skills', n), n);
  }
});

test('skips the gemini link when ~/.gemini is absent', () => {
  const src = makeSource();
  const home = tmp();
  const r = run(src, home);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(join(home, '.gemini')), false);
  assert.match(r.stdout, /skipped .*\.gemini\/skills/);
  assert.match(r.stdout, /skipped .*antigravity-cli\/skills/);
});

test('second run leaves identical state and reports links unchanged', () => {
  const src = makeSource();
  const home = tmp();
  mkdirSync(join(home, '.gemini'));
  assert.equal(run(src, home).status, 0);
  const before = snapshot(home);
  const r = run(src, home);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(snapshot(home), before);
  assert.equal((r.stdout.match(/unchanged/g) ?? []).length, 10);
  assert.doesNotMatch(r.stdout, /linked /);
});

test('moves a real directory out of the way with a warning', () => {
  const src = makeSource();
  const home = tmp();
  const existing = join(home, '.claude', 'skills', 'huddle-start');
  mkdirSync(existing, { recursive: true });
  writeFileSync(join(existing, 'old.txt'), 'old');
  const r = run(src, home);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /moved to .*\.bak-/);
  assert.equal(readlinkSync(existing), join(home, '.agents', 'skills', 'huddle-start'));
  const backups = readdirSync(dirname(existing)).filter((n) => n.startsWith('huddle-start.bak-'));
  assert.equal(backups.length, 1);
});

test('fails when node is missing', (t) => {
  const probe = spawnSync('/bin/sh', ['-c', 'command -v node'], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
  if (probe.status === 0) return t.skip('node is on /usr/bin:/bin');
  const r = run(makeSource(), tmp(), { path: '/usr/bin:/bin' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /agent-huddle needs Node\.js 20 or newer \(node not found\)/);
});

test('fails on Node older than 20', () => {
  const bin = tmp();
  writeFileSync(join(bin, 'node'), '#!/bin/sh\necho v18.19.0\n');
  chmodSync(join(bin, 'node'), 0o755);
  const home = tmp();
  const r = run(makeSource(), home, { path: `${bin}:/usr/bin:/bin` });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /agent-huddle needs Node\.js 20 or newer \(found v18\.19\.0\)/);
  assert.equal(existsSync(join(home, '.agents')), false);
});
