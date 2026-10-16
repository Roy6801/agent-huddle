#!/usr/bin/env node
// Release tooling. Never writes changelog text: it validates a hand-written entry and files it under a heading.
//   node scripts/release.mjs <entry-file> [--minor|--major]   bump all versions, add the entry, refresh release.lock.json
//   node scripts/release.mjs check                            fail when versions, changelog or the download disagree
//   node scripts/release.mjs notes                            print the newest changelog entry
// RELEASE_ROOT points the script at another checkout (used by tests). Zero dependencies; Node 20+.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GROUPS = ['New', 'Improved', 'Fixed'];
const HEADING = /^## (\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)\s*$/m;
const VERSION_LINE = /^const VERSION = '[^']*';$/m;

const rootDir = () => path.resolve(process.env.RELEASE_ROOT || HERE);
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (root, rel) => JSON.parse(read(root, rel));

export function productFiles(root) {
  const files = ['install.sh', 'install.mjs'];
  const skills = path.join(root, 'skills');
  const dirs = fs
    .readdirSync(skills, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(skills, d.name, 'SKILL.md')))
    .map((d) => d.name);
  for (const name of dirs) {
    for (const d of fs.readdirSync(path.join(skills, name), { withFileTypes: true })) {
      if (d.isFile()) files.push(`skills/${name}/${d.name}`);
    }
  }
  return files.sort();
}

export function fingerprint(root = rootDir()) {
  const hash = crypto.createHash('sha256');
  for (const rel of productFiles(root)) {
    let content = fs.readFileSync(path.join(root, rel));
    if (rel === 'skills/agent-huddle/huddle.mjs') {
      content = Buffer.from(content.toString('utf8').replace(VERSION_LINE, "const VERSION = '';"));
    }
    hash.update(`${rel}\0`).update(content).update('\0');
  }
  return hash.digest('hex');
}

export function readVersions(root = rootDir()) {
  const huddle = read(root, 'skills/agent-huddle/huddle.mjs').match(/^const VERSION = '([^']*)';$/m);
  return {
    'package.json': readJson(root, 'package.json').version,
    '.claude-plugin/plugin.json': readJson(root, '.claude-plugin/plugin.json').version,
    '.claude-plugin/marketplace.json': readJson(root, '.claude-plugin/marketplace.json').plugins.map((p) => p.version).join(','),
    'skills/agent-huddle/huddle.mjs': huddle ? huddle[1] : '(missing)',
  };
}

export function validateEntry(text) {
  const problems = [];
  const lines = text.split('\n');
  const first = lines.find((l) => l.trim());
  if (!first) return ['The entry is empty: write a one-line headline ending with a full stop, then ### New / ### Improved / ### Fixed groups.'];
  if (/^#/.test(first)) problems.push('The entry must start with a one-line headline, not a heading.');
  else if (!/[.!?]$/.test(first.trim())) problems.push('The headline (first line) must end with ".", "!" or "?".');
  if (/unreleased/i.test(text)) problems.push('The entry must not mention "Unreleased": every release has a version.');
  const groups = [];
  let bullets = 0;
  const closeGroup = () => {
    if (groups.length && bullets === 0) problems.push(`### ${groups[groups.length - 1]} needs at least one "- " bullet.`);
    bullets = 0;
  };
  for (const line of lines) {
    const h = line.match(/^(#+)\s*(.*?)\s*$/);
    if (h) {
      if (h[1].length < 3) problems.push(`Remove the "${line.trim()}" heading: only ### New, ### Improved and ### Fixed are allowed.`);
      else if (h[1].length === 3 && GROUPS.includes(h[2])) {
        closeGroup();
        groups.push(h[2]);
      } else problems.push(`Remove the "${line.trim()}" heading: only ### New, ### Improved and ### Fixed are allowed.`);
    } else if (groups.length && /^- \S/.test(line)) bullets++;
  }
  closeGroup();
  if (!groups.length) problems.push('Add at least one of ### New, ### Improved or ### Fixed, each with "- " bullets.');
  const order = groups.map((g) => GROUPS.indexOf(g));
  if (order.some((n, i) => i && n <= order[i - 1])) problems.push('Groups must be in the order New, Improved, Fixed, each at most once.');
  return problems;
}

function newest(changelog) {
  const m = HEADING.exec(changelog);
  const any = changelog.match(/^## .*$/m);
  if (!any) return null;
  const start = any.index;
  const rest = changelog.slice(start + any[0].length);
  const next = rest.search(/^## /m);
  return { heading: any[0], version: m && m.index === start ? m[1] : null, date: m && m.index === start ? m[2] : null, entry: (next < 0 ? rest : rest.slice(0, next)).trim() };
}

function bump(version, kind) {
  const [a, b, c] = version.split('.').map(Number);
  if (kind === 'major') return `${a + 1}.0.0`;
  if (kind === 'minor') return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`;
}

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function writeLock(root, version) {
  fs.writeFileSync(path.join(root, 'release.lock.json'), `${JSON.stringify({ version, fingerprint: fingerprint(root) }, null, 2)}\n`);
}

export function check(root = rootDir()) {
  const problems = [];
  const versions = readVersions(root);
  const pkg = versions['package.json'];
  if (new Set(Object.values(versions)).size > 1) {
    problems.push(`Versions disagree (${Object.entries(versions).map(([k, v]) => `${k} ${v}`).join(', ')}): set them all to the same value, or run \`bun run release <entry-file>\`.`);
  }
  let lock = null;
  try {
    lock = readJson(root, 'release.lock.json');
  } catch {
    problems.push('release.lock.json is missing or unreadable: run `bun run release <entry-file>` to write it.');
  }
  if (lock && lock.version !== pkg) problems.push(`release.lock.json says ${lock.version} but package.json says ${pkg}: run \`bun run release <entry-file>\`.`);
  const top = newest(read(root, 'CHANGELOG.md'));
  if (!top || top.version !== pkg) {
    problems.push(`The newest CHANGELOG.md heading must be "## ${pkg} (<YYYY-MM-DD>)": run \`bun run release <entry-file>\` instead of editing the version by hand.`);
  } else {
    for (const p of validateEntry(top.entry)) problems.push(`CHANGELOG.md ${pkg} entry: ${p}`);
  }
  if (lock && lock.fingerprint !== fingerprint(root)) {
    problems.push('The download changed but the version did not: write a curated entry and run `bun run release <entry-file>`.');
  }
  return { problems, version: pkg };
}

function release(root, args) {
  const flags = args.filter((a) => a.startsWith('--'));
  const files = args.filter((a) => !a.startsWith('--'));
  const bad = flags.filter((f) => f !== '--minor' && f !== '--major');
  if (bad.length || files.length !== 1 || flags.length > 1) {
    throw new Error('Usage: node scripts/release.mjs <entry-file> [--minor|--major]');
  }
  const kind = flags[0] ? flags[0].slice(2) : 'patch';
  const entry = fs.readFileSync(path.resolve(files[0]), 'utf8').trim();
  const problems = validateEntry(entry);
  if (problems.length) throw new Error(`Entry refused, nothing changed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  const changelog = read(root, 'CHANGELOG.md');
  const at = changelog.search(/^## /m);
  if (at < 0) throw new Error('CHANGELOG.md has no release heading to insert above.');
  const next = bump(readJson(root, 'package.json').version, kind);

  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: root, encoding: 'utf8' });
  if (diff.status === 0 && diff.stdout.split('\n').some((f) => f.startsWith('room/src/'))) {
    const build = spawnSync('bun', ['run', 'build:room'], { cwd: root, stdio: 'inherit' });
    if (build.status !== 0) throw new Error('bun run build:room failed, nothing changed: fix the build and run release again.');
  }

  const setJsonVersion = (rel) => {
    const text = read(root, rel);
    fs.writeFileSync(path.join(root, rel), text.replace(/("version":\s*")[^"]*(")/, `$1${next}$2`));
  };
  setJsonVersion('package.json');
  setJsonVersion('.claude-plugin/plugin.json');
  setJsonVersion('.claude-plugin/marketplace.json');
  const huddle = 'skills/agent-huddle/huddle.mjs';
  fs.writeFileSync(path.join(root, huddle), read(root, huddle).replace(VERSION_LINE, `const VERSION = '${next}';`));
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), `${changelog.slice(0, at)}## ${next} (${today()})\n\n${entry}\n\n${changelog.slice(at)}`);

  writeLock(root, next);
  return next;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const root = rootDir();
  try {
    if (cmd === 'check') {
      const { problems, version } = check(root);
      if (problems.length) {
        for (const p of problems) console.error(p);
        process.exit(1);
      }
      console.log(`release check ok (${version})`);
    } else if (cmd === 'notes') {
      const top = newest(read(root, 'CHANGELOG.md'));
      if (!top) throw new Error('CHANGELOG.md has no release entry.');
      console.log(top.entry);
    } else {
      console.log(release(root, cmd ? [cmd, ...rest] : rest));
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
