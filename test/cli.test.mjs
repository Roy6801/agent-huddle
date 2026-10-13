import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';

const CLI = new URL('../huddle.mjs', import.meta.url).pathname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-'));
let env;

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function run(childEnv, ...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env: childEnv }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

const cli = (...args) => run(env, ...args);

function serverPids(dir) {
  return execFileSync('ps', ['eww', '-ax', '-o', 'pid=,command='], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.includes('huddle.mjs serve') && line.includes(`AGENT_HUDDLE_HOME=${dir}`));
}

const serverJson = () => JSON.parse(fs.readFileSync(path.join(home, 'server.json'), 'utf8'));

after(async () => {
  if (env) await cli('down');
  fs.rmSync(home, { recursive: true, force: true });
});

test('new twice reuses one server and prints join and page URLs', async () => {
  const port = await freePort();
  env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(port) };

  const first = await cli('new', 'sprite', 'game');
  assert.equal(first.code, 0, first.stderr);
  const a = JSON.parse(first.stdout);
  const info = serverJson();
  assert.equal(info.port, port);
  assert.equal(a.title, 'sprite game');
  assert.ok(a.join.startsWith(`http://127.0.0.1:${port}/s/`));
  assert.match(a.page, /\/s\/[^/]+\/h\/[^/]+$/);

  const second = await cli('new');
  const b = JSON.parse(second.stdout);
  assert.ok(b.join.startsWith(`http://127.0.0.1:${port}/s/`));
  assert.notEqual(a.id, b.id);
  assert.equal(serverJson().pid, info.pid);

  const upAgain = await cli('up');
  assert.equal(upAgain.stdout.trim(), `http://127.0.0.1:${port}`);
  assert.equal(serverJson().pid, info.pid);

  const proto = await fetch(a.join);
  assert.match(await proto.text(), /sprite game/);
});

test('doctor passes while the server runs, down stops it', async () => {
  const doctor = await cli('doctor');
  assert.equal(doctor.code, 0, doctor.stdout);
  assert.match(doctor.stdout, /✓ server healthy/);

  const { pid, port } = serverJson();
  const down = await cli('down');
  assert.equal(down.stdout.trim(), 'stopped');
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));
  assert.throws(() => process.kill(pid, 0));
  assert.equal(fs.existsSync(path.join(home, 'server.json')), false);
});

test('concurrent up calls share one server', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-'));
  const port = await freePort();
  const own = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(port) };
  try {
    const results = await Promise.all([run(own, 'up'), run(own, 'up'), run(own, 'up')]);
    for (const res of results) {
      assert.equal(res.code, 0, res.stderr);
      assert.equal(res.stdout.trim(), `http://127.0.0.1:${port}`);
    }
    await new Promise((res) => setTimeout(res, 500));
    assert.equal(serverPids(dir).length, 1, serverPids(dir).join('\n'));
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'server.json'), 'utf8'));
    assert.equal(info.port, port);
    assert.doesNotThrow(() => process.kill(info.pid, 0));
  } finally {
    await run(own, 'down');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('up recovers from a stale server.json', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-'));
  const port = await freePort();
  const stalePort = await freePort();
  const own = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(port) };
  const dead = execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], {
    encoding: 'utf8',
  });
  fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port: stalePort, pid: Number(dead) }));
  try {
    const res = await run(own, 'up');
    assert.equal(res.code, 0, res.stderr);
    assert.equal(res.stdout.trim(), `http://127.0.0.1:${port}`);
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'server.json'), 'utf8'));
    assert.equal(info.port, port);
    assert.notEqual(info.pid, Number(dead));
  } finally {
    await run(own, 'down');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('help prints usage', async () => {
  const res = await cli('help');
  assert.match(res.stdout, /Usage: node huddle.mjs/);
});
