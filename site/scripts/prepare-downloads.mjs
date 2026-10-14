#!/usr/bin/env node
// Copies install.sh, install.mjs, README, LICENSE and skills/ from the repo root into site/public
// and writes site/public/agent-huddle.zip. Zero dependencies; needs Node 22+ for zlib.crc32.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SITE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.dirname(SITE);
const PUBLIC = path.join(SITE, 'public');
const ROOT_FILES = [
  { name: 'install.sh', mode: 0o755 },
  { name: 'install.mjs', mode: 0o755 },
  { name: 'README.md', mode: 0o644 },
  { name: 'LICENSE', mode: 0o644 },
];

const SKILLS = fs
  .readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'skills', d.name, 'SKILL.md')))
  .map((d) => d.name)
  .sort();

const SKILL_FILES = SKILLS.flatMap((name) =>
  fs
    .readdirSync(path.join(ROOT, 'skills', name), { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => ({
      name: `skills/${name}/${d.name}`,
      mode: name === 'agent-huddle' && d.name === 'huddle.mjs' ? 0o755 : 0o644,
    }))
    .sort((x, y) => x.name.localeCompare(y.name)),
);
const FILES = [...ROOT_FILES, ...SKILL_FILES];

if (typeof zlib.crc32 !== 'function') {
  console.error(`prepare-downloads needs Node 22 or newer (found ${process.version})`);
  process.exit(1);
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// A standard PKZIP archive: local headers, central directory, end record.
// "Version made by" is Unix (3) so external attributes carry the file mode.
function makeZip(entries, when) {
  const { time, date } = dosDateTime(when);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const isDir = e.name.endsWith('/');
    const raw = e.data ?? Buffer.alloc(0);
    const data = isDir ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const method = isDir ? 0 : 8;
    const crc = isDir ? 0 : zlib.crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const mode = (isDir ? 0o040000 : 0o100000) | e.mode;
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(((mode << 16) | (isDir ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

fs.mkdirSync(PUBLIC, { recursive: true });
fs.rmSync(path.join(PUBLIC, 'skills'), { recursive: true, force: true });
for (const legacy of ['huddle.mjs', 'SKILL.md', 'page.html']) fs.rmSync(path.join(PUBLIC, legacy), { force: true });

const zipEntries = [{ name: 'agent-huddle/', mode: 0o755 }];
for (const f of FILES) {
  const data = fs.readFileSync(path.join(ROOT, f.name));
  const dest = path.join(PUBLIC, f.name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
  fs.chmodSync(dest, f.mode);
  zipEntries.push({ name: `agent-huddle/${f.name}`, mode: f.mode, data });
}

const epoch = Number(process.env.SOURCE_DATE_EPOCH);
const zip = makeZip(zipEntries, Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000) : new Date());
fs.writeFileSync(path.join(PUBLIC, 'agent-huddle.zip'), zip);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log('agent-huddle downloads prepared');
for (const name of [...FILES.map((f) => f.name), 'agent-huddle.zip']) {
  console.log(`  ${name.padEnd(32)} ${kb(fs.statSync(path.join(PUBLIC, name)).size).padStart(9)}`);
}
