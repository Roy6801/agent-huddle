import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'site', 'public');
const zip = join(pub, 'agent-huddle.zip');
const FILES = ['install.sh', 'huddle.mjs', 'SKILL.md', 'page.html', 'README.md', 'LICENSE'];

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

before(() => {
  const r = run(process.execPath, [join(root, 'site', 'scripts', 'prepare-downloads.mjs')], { cwd: root });
  assert.equal(r.status, 0, r.stderr);
});

test('downloadable files are byte-identical to the repo root', () => {
  for (const f of FILES) {
    assert.ok(existsSync(join(pub, f)), `${f} missing`);
    assert.deepEqual(readFileSync(join(pub, f)), readFileSync(join(root, f)), f);
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
