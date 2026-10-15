import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-wait-'));
let env;

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function cli(...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

const join = async (url, harness) =>
  (await fetch(`${url}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ harness }),
  })).json();

async function room() {
  const created = JSON.parse((await cli('new', 'wait room')).stdout);
  const a = await join(created.join, 'claude');
  const b = await join(created.join, 'codex');
  return { created, a, b };
}

test('setup', async () => {
  env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
});

after(async () => {
  if (env) await cli('down');
  fs.rmSync(home, { recursive: true, force: true });
});

test('wait prints the messages and exits 0 when mentioned', async () => {
  const { a, b } = await room();
  const waiting = cli('wait', a.link, '--minutes', '1');
  await new Promise((r) => setTimeout(r, 500));
  await fetch(`${b.link}/post`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: `@${a.handle} your turn` }),
  });
  const r = await waiting;
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.messages.at(-1).text, `@${a.handle} your turn`);
});

test('wait times out with a timeout object', async () => {
  const { a } = await room();
  const r = await cli('wait', a.link, '--minutes', '0.02');
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { timeout: true, minutes: 0.02 });
});

test('wait exits 3 after the room is ended', async () => {
  const { created, a } = await room();
  await cli('end', created.id, '--yes');
  const r = await cli('wait', a.link, '--minutes', '1');
  assert.equal(r.code, 3);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(out), ['error', 'message', 'instruction', 'transcript']);
  assert.equal(out.error, 'room_ended');
});

test('wait exits 4 for an unknown token', async () => {
  const { a } = await room();
  const r = await cli('wait', a.link.replace(/[^/]+$/, 'nope'), '--minutes', '1');
  assert.equal(r.code, 4, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.error, 'unknown_token');
  assert.match(out.instruction, new RegExp(`${a.link.replace(/\/as\/.*$/, '')}/join`));
});

test('wait exits 2 with a doctor instruction when the server is unreachable', async () => {
  const link = `http://127.0.0.1:${await freePort()}/s/room/as/token`;
  const r = await new Promise((resolve) => {
    execFile(process.execPath, [CLI, 'wait', link, '--minutes', '1'], { env: { ...env, AGENT_HUDDLE_RETRY_MS: '10' } }, (error, stdout) =>
      resolve({ code: error ? error.code : 0, stdout }),
    );
  });
  assert.equal(r.code, 2);
  const out = JSON.parse(r.stdout);
  assert.equal(out.error, 'server_unreachable');
  assert.match(out.instruction, /doctor/);
});

test('wait rejects human page links, join URLs and bad minutes', async () => {
  const { created, a } = await room();
  const page = await cli('wait', created.page);
  assert.equal(page.code, 1);
  assert.match(page.stderr, /agent link/);
  assert.equal((await cli('wait', created.join)).code, 1);
  assert.equal((await cli('wait', a.link, '--minutes', '0')).code, 1);
  assert.equal((await cli('wait', a.link, '--minutes', '60')).code, 1);
});
