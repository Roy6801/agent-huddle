import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts', 'release.mjs');
const { writeLock } = await import(script);
const FILES = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'skills/agent-huddle/huddle.mjs',
  'skills/agent-huddle/SKILL.md',
  'skills/huddle-start/SKILL.md',
  'install.sh',
  'install.mjs',
  'README.md',
  'CHANGELOG.md',
  'release.lock.json',
];
const ENTRY = 'A small fix for the room page.\n\n### Fixed\n\n- The page no longer flickers.\n';

const run = (args, cwd) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, RELEASE_ROOT: cwd } });
const get = (dir, f) => readFileSync(join(dir, f), 'utf8');
const versionsIn = (dir) => [
  JSON.parse(get(dir, 'package.json')).version,
  JSON.parse(get(dir, '.claude-plugin/plugin.json')).version,
  JSON.parse(get(dir, '.claude-plugin/marketplace.json')).plugins[0].version,
  get(dir, 'skills/agent-huddle/huddle.mjs').match(/^const VERSION = '([^']*)';$/m)[1],
];

let tmp;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'release-'));
  for (const f of FILES) {
    mkdirSync(dirname(join(tmp, f)), { recursive: true });
    cpSync(join(root, f), join(tmp, f));
  }
  writeFileSync(join(tmp, 'entry.md'), ENTRY);
  writeLock(tmp, JSON.parse(get(tmp, 'package.json')).version);
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

test('the four version fields agree', () => {
  assert.equal(new Set(versionsIn(root)).size, 1);
});

test('a patch release bumps every version, adds the heading and rewrites the lock', () => {
  const [before] = versionsIn(tmp);
  const [a, b, c] = before.split('.').map(Number);
  const next = `${a}.${b}.${c + 1}`;
  const r = run([join(tmp, 'entry.md')], tmp);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), next);
  assert.deepEqual(versionsIn(tmp), [next, next, next, next]);
  assert.match(get(tmp, 'CHANGELOG.md'), new RegExp(`^# Changelog[\\s\\S]*?\\n## ${next.replaceAll('.', '\\.')} \\(\\d{4}-\\d{2}-\\d{2}\\)\\n\\nA small fix for the room page\\.\\n\\n### Fixed\\n\\n- The page no longer flickers\\.\\n\\n## ${before.replaceAll('.', '\\.')} `));
  assert.equal(JSON.parse(get(tmp, 'release.lock.json')).version, next);
  const check = run(['check'], tmp);
  assert.equal(check.status, 0, check.stderr);
});

test('--minor bumps the minor and resets the patch', () => {
  const [a, b] = versionsIn(tmp)[0].split('.').map(Number);
  const r = run([join(tmp, 'entry.md'), '--minor'], tmp);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), `${a}.${b + 1}.0`);
});

test('invalid entries are refused and nothing changes', () => {
  const bad = {
    'no group': 'Just a headline.\n',
    unreleased: 'Unreleased changes land here.\n\n### New\n\n- Something.\n',
    'empty group': 'Headline.\n\n### Fixed\n',
    'no full stop': 'Headline\n\n### Fixed\n\n- Something.\n',
    'wrong order': 'Headline.\n\n### Fixed\n\n- A.\n\n### New\n\n- B.\n',
    'top heading': 'Headline.\n\n## Extra\n\n### New\n\n- A.\n',
  };
  const snapshot = FILES.map((f) => get(tmp, f));
  for (const [name, text] of Object.entries(bad)) {
    writeFileSync(join(tmp, 'entry.md'), text);
    const r = run([join(tmp, 'entry.md')], tmp);
    assert.notEqual(r.status, 0, name);
    assert.deepEqual(FILES.map((f) => get(tmp, f)), snapshot, name);
  }
});

test('changing a skills file without a release fails the check', () => {
  const f = join(tmp, 'skills/huddle-start/SKILL.md');
  writeFileSync(f, `${readFileSync(f, 'utf8')}\nExtra line.\n`);
  const r = run(['check'], tmp);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /The download changed but the version did not: write a curated entry and run `pnpm release <entry-file>`\./);
});

test('editing README.md does not require a release', () => {
  writeFileSync(join(tmp, 'README.md'), `${get(tmp, 'README.md')}\nMore docs.\n`);
  const r = run(['check'], tmp);
  assert.equal(r.status, 0, r.stderr);
});

test('check fails when versions disagree', () => {
  const f = join(tmp, '.claude-plugin/plugin.json');
  writeFileSync(f, get(tmp, '.claude-plugin/plugin.json').replace(/("version":\s*")[^"]*/, '$19.9.9'));
  const r = run(['check'], tmp);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Versions disagree/);
});

test('notes prints the newest entry only', () => {
  const r = run(['notes'], tmp);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /^## /m);
  assert.ok(r.stdout.trim().length > 0);
  assert.ok(existsSync(join(tmp, 'CHANGELOG.md')));
});
