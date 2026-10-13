import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'site', 'dist');
const zip = join(dist, 'agent-huddle.zip');
const FILES = ['install.sh', 'huddle.mjs', 'SKILL.md', 'page.html', 'README.md', 'LICENSE'];

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

before(() => {
  const r = run(process.execPath, [join(root, 'site', 'build.mjs')], {
    cwd: root,
    env: { ...process.env, SITE_URL: 'https://example.test/' },
  });
  assert.equal(r.status, 0, r.stderr);
});

test('index.html has the site URL filled in', () => {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  assert.ok(!html.includes('__SITE_URL__'));
  assert.ok(html.includes('curl -fsSL https://example.test/install.sh | bash'));
  assert.ok(!html.includes('https://example.test//'), 'no doubled slash from a trailing slash');
});

test('downloadable files are byte-identical to the repo root', () => {
  for (const f of FILES) {
    assert.ok(existsSync(join(dist, f)), `${f} missing`);
    assert.deepEqual(readFileSync(join(dist, f)), readFileSync(join(root, f)), f);
  }
});

test('the zip is valid and keeps executable modes', () => {
  const t = run('unzip', ['-t', zip]);
  assert.equal(t.status, 0, t.stdout + t.stderr);
  assert.match(t.stdout, /No errors detected/);
  const info = run('zipinfo', [zip]);
  assert.equal(info.status, 0, info.stderr);
  const mode = (name) => info.stdout.split('\n').find((l) => l.trim().endsWith(`agent-huddle/${name}`))?.split(/\s+/)[0];
  assert.equal(mode('install.sh'), '-rwxr-xr-x');
  assert.equal(mode('huddle.mjs'), '-rwxr-xr-x');
  for (const f of ['SKILL.md', 'page.html', 'README.md', 'LICENSE']) assert.equal(mode(f), '-rw-r--r--', f);
});

test('the zip extracts to agent-huddle/ with identical bytes', () => {
  const out = mkdtempSync(join(tmpdir(), 'huddle-site-'));
  try {
    const x = run('unzip', ['-q', zip, '-d', out]);
    assert.equal(x.status, 0, x.stderr);
    for (const f of FILES) {
      assert.deepEqual(readFileSync(join(out, 'agent-huddle', f)), readFileSync(join(root, f)), f);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
