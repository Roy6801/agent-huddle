import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'site', 'public');
const zip = join(pub, 'agent-huddle.zip');
const SKILL_FILES = [
  'skills/agent-huddle/SKILL.md',
  'skills/agent-huddle/huddle.mjs',
  'skills/agent-huddle/page.html',
  ...['huddle-start', 'huddle-join', 'huddle-rooms', 'huddle-end'].map((v) => `skills/${v}/SKILL.md`),
];
const FILES = ['install.sh', 'install.mjs', 'README.md', 'LICENSE', ...SKILL_FILES];

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

before(() => {
  const r = run(process.execPath, [join(root, 'site', 'scripts', 'prepare-downloads.mjs')], { cwd: root });
  assert.equal(r.status, 0, r.stderr);
});

test('downloadable files are byte-identical to the repo', () => {
  for (const f of FILES) {
    assert.ok(existsSync(join(pub, f)), `${f} missing`);
    assert.deepEqual(readFileSync(join(pub, f)), readFileSync(join(root, f)), f);
  }
});

test('no root-level copies of the skill files are published', () => {
  for (const f of ['huddle.mjs', 'SKILL.md', 'page.html']) assert.equal(existsSync(join(pub, f)), false, f);
});

test('the hero demo is a committed, self-contained page with no server calls, kept out of page.html', () => {
  const demo = readFileSync(join(pub, 'demo.html'), 'utf8');
  assert.match(demo, /^<!doctype html>\n<!-- generated from room\/ by `pnpm build:room`; do not edit -->\n/);
  assert.doesNotMatch(demo, /<script[^>]*\ssrc=|<link[^>]*\shref=/, 'scripts and styles are inlined');
  for (const s of ['/api/state', '/api/files', 'XMLHttpRequest']) assert.equal(demo.includes(s), false, s);
  const page = readFileSync(join(root, 'skills/agent-huddle/page.html'), 'utf8');
  for (const s of ['demo-controls', 'Moonhop']) assert.equal(page.includes(s), false, s);
});

test('the zip is valid and keeps executable modes', () => {
  const t = run('unzip', ['-t', zip]);
  assert.equal(t.status, 0, t.stdout + t.stderr);
  assert.match(t.stdout, /No errors detected/);
  const info = run('zipinfo', [zip]);
  assert.equal(info.status, 0, info.stderr);
  const mode = (name) => info.stdout.split('\n').find((l) => l.trim().endsWith(`agent-huddle/${name}`))?.split(/\s+/)[0];
  const executable = ['install.sh', 'install.mjs', 'skills/agent-huddle/huddle.mjs'];
  for (const f of executable) assert.equal(mode(f), '-rwxr-xr-x', f);
  for (const f of FILES.filter((x) => !executable.includes(x))) assert.equal(mode(f), '-rw-r--r--', f);
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

test('version.json matches package.json and the VERSION in huddle.mjs', () => {
  const published = JSON.parse(readFileSync(join(pub, 'version.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const cli = /const VERSION = '([^']+)'/.exec(readFileSync(join(root, 'skills/agent-huddle/huddle.mjs'), 'utf8'))[1];
  assert.deepEqual(Object.keys(published), ['version']);
  assert.equal(published.version, pkg.version);
  assert.equal(cli, pkg.version);
});

test('docs say a record is kept and the server stops when idle', () => {
  const sources = [
    'README.md',
    'GLOSSARY.md',
    ...SKILL_FILES.filter((f) => f.endsWith('SKILL.md')),
    'site/components/sections/faq.tsx',
    'site/components/sections/features.tsx',
    'site/components/sections/how-it-works.tsx',
  ];
  for (const f of sources) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const old of ['stops with the last room', 'rooms are lost when the server stops', 'asking for it is the yes']) {
      assert.equal(text.includes(old), false, `${f}: ${old}`);
    }
  }
  for (const f of ['README.md', 'site/components/sections/faq.tsx']) {
    assert.ok(readFileSync(join(root, f), 'utf8').includes('~/.agent-huddle/history'), f);
  }
});

test('CHANGELOG.md starts with # Changelog, has a heading for the current version and no Unreleased section', () => {
  const md = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(md.startsWith('# Changelog\n'));
  const headings = md.split('\n').filter((l) => l.startsWith('## '));
  assert.ok(headings.some((h) => h.startsWith(`## ${version} (`)), `no ## ${version} heading`);
  assert.ok(!headings.some((h) => /unreleased/i.test(h)), 'no Unreleased section');
  assert.equal(readFileSync(join(pub, 'CHANGELOG.md'), 'utf8'), md, 'site copy matches');
});

test('analytics live on the landing site only, never in the product', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'site', 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies['@vercel/analytics'] && pkg.dependencies['@vercel/speed-insights']);
  assert.match(readFileSync(join(root, 'site', 'app', 'layout.tsx'), 'utf8'), /<Analytics \/>[\s\S]*<SpeedInsights \/>/);
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : [p];
  });
  const product = [...walk(join(root, 'skills')), ...walk(join(root, 'room', 'src')), join(root, 'install.sh'), join(root, 'install.mjs'), join(root, 'package.json')];
  for (const f of product) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /@vercel\/(analytics|speed-insights)|vercel\.live|va\.vercel-scripts/, f);
  }
});
