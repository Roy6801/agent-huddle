import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { compareVersions } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const VERSION = /const VERSION = '([^']+)'/.exec(fs.readFileSync(CLI, 'utf8'))[1];
const bump = (v, part) => v.split('.').map((n, i) => (i === part ? Number(n) + 1 : n)).join('.');

let stub;
let latest = VERSION;
let baseUrl;
let home;

before(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-upgrade-'));
  stub = http.createServer((req, res) => {
    if (req.url === '/version.json') return res.end(JSON.stringify({ version: latest }));
    if (req.url === '/install.sh') return res.end('echo "stub installer args: $*"\n');
    res.statusCode = 404;
    res.end();
  });
  await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${stub.address().port}`;
});

after(() => {
  stub.close();
  fs.rmSync(home, { recursive: true, force: true });
});

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function cli(args, env = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      { env: { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_BASE_URL: baseUrl, ...env } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

test('compareVersions compares numerically', () => {
  assert.equal(compareVersions('0.2.0', '0.10.0'), -1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.2', '1.2.3'), null);
  assert.equal(compareVersions('nope', '1.2.3'), null);
});

test('doctor reports up to date', async () => {
  latest = VERSION;
  const r = await cli(['doctor'], { AGENT_HUDDLE_PORT: String(await freePort()) });
  assert.match(r.stdout, /Version\n {2}up to date \(/);
});

test('doctor reports an available update without failing on it', async () => {
  latest = bump(VERSION, 1);
  const r = await cli(['doctor'], { AGENT_HUDDLE_PORT: String(await freePort()) });
  assert.ok(r.stdout.includes(`update available: ${VERSION} → ${latest}. Run: node ${CLI} upgrade`), r.stdout);
});

test('doctor says it could not check when the site is unreachable', async () => {
  const r = await cli(['doctor'], {
    AGENT_HUDDLE_PORT: String(await freePort()),
    AGENT_HUDDLE_BASE_URL: `http://127.0.0.1:${await freePort()}`,
  });
  assert.match(r.stdout, /could not check \(offline\?\)/);
});

test('upgrade --check prints the version line and exits 0', async () => {
  latest = bump(VERSION, 2);
  const r = await cli(['upgrade', '--check']);
  assert.equal(r.code, 0);
  assert.ok(r.stdout.includes(`update available: ${VERSION} → ${latest}`));
  assert.ok(!r.stdout.includes('stub installer'));
});

test('update is an alias of upgrade', async () => {
  latest = bump(VERSION, 2);
  const r = await cli(['update', '--check']);
  assert.equal(r.code, 0);
  assert.ok(r.stdout.includes(`update available: ${VERSION} → ${latest}`));
  assert.match((await cli(['help'])).stdout, /upgrade, update +install the latest version/);
});

test('upgrade does nothing when already up to date', async () => {
  latest = VERSION;
  const r = await cli(['upgrade']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /up to date/);
  assert.ok(!r.stdout.includes('stub installer'));
});

test('upgrade announces, runs the installer with --yes and asks for a restart', async () => {
  latest = bump(VERSION, 0);
  const r = await cli(['upgrade']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /install\.sh with --yes/);
  assert.match(r.stdout, /stub installer args: --yes/);
  assert.match(r.stdout, /Restart your agents/);
});

test('help groups the commands and lists the skills', async () => {
  for (const args of [['help'], ['--help'], ['-h']]) {
    const r = await cli(args);
    assert.equal(r.code, 0);
    const at = ['Rooms', 'Agents', 'Server', 'Maintenance'].map((h) => r.stdout.indexOf(`\n${h}\n`));
    assert.ok(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]), r.stdout);
    assert.match(r.stdout, /Skills: \/huddle-start \(start\), \/huddle-join \(join\), \/huddle-rooms \(rooms, open\), \/huddle-end \(end\)/);
    assert.match(r.stdout, /upgrade/);
  }
});

test('help <command> prints usage, options and an example', async () => {
  const r = await cli(['help', 'end']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /node huddle\.mjs end <room>/);
  assert.match(r.stdout, /Options[\s\S]*--yes/);
  assert.match(r.stdout, /Example/);
});

test('help for an unknown command lists the commands and exits 1', async () => {
  const r = await cli(['help', 'nope']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Unknown command "nope"/);
  assert.match(r.stdout, /\nRooms\n/);
});
