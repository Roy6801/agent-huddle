import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const homes = [];

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-end-'));
  const port = await freePort();
  const env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(port) };
  const ctx = { home, port, env };
  homes.push(ctx);
  return ctx;
}

function cli(ctx, ...args) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [CLI, ...args], { env: ctx.env }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
    child.stdin.end();
  });
}

const newRoom = async (ctx, name) => JSON.parse((await cli(ctx, 'new', name)).stdout);
const live = async (ctx) => JSON.parse((await cli(ctx, 'ls', '--json')).stdout);
const stateFile = (ctx) => path.join(ctx.home, 'server.json');
const serverUp = (ctx) =>
  fetch(`http://127.0.0.1:${ctx.port}/health`, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);

async function waitDown(ctx) {
  for (let i = 0; i < 50 && (await serverUp(ctx) || fs.existsSync(stateFile(ctx))); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

afterEach(async () => {
  while (homes.length) {
    const ctx = homes.pop();
    await cli(ctx, 'down');
    fs.rmSync(ctx.home, { recursive: true, force: true });
  }
});

test('end without a room targets the only live room, and lists rooms when there are several', async () => {
  const ctx = await setup();
  const room = await newRoom(ctx, 'demo run');
  const one = await cli(ctx, 'end');
  assert.equal(one.code, 1);
  assert.match(one.stdout, new RegExp(`Would end room:\\n  "demo run" \\(${room.id.slice(0, 8)}`));
  const other = await newRoom(ctx, 'second');
  const res = await cli(ctx, 'end');
  assert.equal(res.code, 1);
  assert.match(res.stderr, /Usage: node huddle\.mjs end/);
  assert.match(res.stderr, new RegExp(`second  ${other.id.slice(0, 8)}`));
  assert.equal((await live(ctx)).length, 2);
});

test('end without --yes and without a TTY ends nothing', async () => {
  const ctx = await setup();
  const room = await newRoom(ctx, 'demo run');
  const res = await cli(ctx, 'end', 'demo run');
  assert.equal(res.code, 1);
  assert.match(res.stdout, /Nothing ended\. Rerun with --yes after the user confirms\./);
  assert.equal((await live(ctx)).length, 1);
  assert.ok(await serverUp(ctx));
  assert.ok(room.id);
});

test('end --yes ends the last room and stops the server', async () => {
  const ctx = await setup();
  const room = await newRoom(ctx, 'demo run');
  const res = await cli(ctx, 'end', 'demo run', '--yes');
  assert.equal(res.code, 0, res.stderr);
  assert.ok(res.stdout.includes(`Ended "demo run" (${room.id.slice(0, 8)})`));
  assert.match(res.stdout, /Server stopped \(no rooms left\)\./);
  await waitDown(ctx);
  assert.equal(await serverUp(ctx), false);
  assert.equal(fs.existsSync(stateFile(ctx)), false);
});

test('ending one of two rooms keeps the server running', async () => {
  const ctx = await setup();
  await newRoom(ctx, 'one');
  await newRoom(ctx, 'two');
  const res = await cli(ctx, 'end', 'one', '--yes');
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /1 room\(s\) still live; server keeps running\./);
  assert.ok(await serverUp(ctx));
});

test('--keep-server leaves the server running after the last room', async () => {
  const ctx = await setup();
  await newRoom(ctx, 'solo');
  const res = await cli(ctx, 'end', 'solo', '--yes', '--keep-server');
  assert.equal(res.code, 0, res.stderr);
  assert.doesNotMatch(res.stdout, /Server stopped/);
  assert.ok(await serverUp(ctx));
  assert.equal((await live(ctx)).length, 0);
});

test('end all --yes ends every room and stops the server', async () => {
  const ctx = await setup();
  await newRoom(ctx, 'one');
  await newRoom(ctx, 'two');
  const res = await cli(ctx, 'end', 'all', '--yes');
  assert.equal(res.code, 0, res.stderr);
  assert.equal((res.stdout.match(/^Ended /gm) || []).length, 2);
  assert.match(res.stdout, /Server stopped/);
  await waitDown(ctx);
  assert.equal(await serverUp(ctx), false);
  assert.equal(fs.existsSync(stateFile(ctx)), false);
});

test('end all is refused when a live room is named "all"', async () => {
  const ctx = await setup();
  await newRoom(ctx, 'All');
  await newRoom(ctx, 'other');
  const res = await cli(ctx, 'end', 'all', '--yes');
  assert.equal(res.code, 1);
  assert.match(res.stderr, /named "all"/);
  assert.equal((await live(ctx)).length, 2);
  const viaFlag = await cli(ctx, 'end', '--all', '--yes');
  assert.equal(viaFlag.code, 0, viaFlag.stderr);
});

test('admin stop-if-empty refuses while a room is live', async () => {
  const onStop = () => {
    throw new Error('should not stop');
  };
  const huddle = createHuddle({ adminToken: 't', onStop });
  const port = await huddle.listen(0);
  try {
    const base = `http://127.0.0.1:${port}`;
    await fetch(`${base}/new`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const res = await fetch(`${base}/admin/stop-if-empty`, { method: 'POST', headers: { authorization: 'Bearer t' } });
    assert.deepEqual(await res.json(), { stopping: false, live: 1 });
  } finally {
    await huddle.close();
  }
});
