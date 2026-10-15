import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const IDLE = 3000;
const running = [];
const dirs = [];
afterEach(async () => {
  mock.timers.reset();
  while (running.length) await running.pop().close();
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

async function call(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const clock = () => mock.timers.enable({ apis: ['Date'], now: Date.now() });

async function server(opts = {}) {
  const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-idle-'));
  dirs.push(historyDir);
  const idle = { fired: 0 };
  const huddle = createHuddle({ adminToken: 'admin', historyDir, serverIdleMs: IDLE, onIdle: () => idle.fired++, ...opts });
  const base = `http://127.0.0.1:${await huddle.listen(0)}`;
  running.push(huddle);
  const files = (ext) => fs.readdirSync(historyDir).filter((f) => f.endsWith(ext)).map((f) => path.join(historyDir, f));
  const lines = () => fs.readFileSync(files('.jsonl')[0], 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
  const room = async () => {
    const created = (await call('POST', `${base}/new`, { name: 'idle room' })).json;
    const agent = (await call('POST', `${created.join}/join`, { harness: 'claude' })).json;
    return { created, agent };
  };
  const tick = (ms) => {
    mock.timers.tick(ms);
    huddle.sweep();
  };
  return { huddle, base, idle, files, lines, room, tick };
}

const header = (file) => fs.readFileSync(file, 'utf8').split('\n')[2];

test('AC-100: an idle server ends its live rooms with a reason, then fires onIdle once', async () => {
  clock();
  const h = await server();
  const { agent } = await h.room();
  h.tick(IDLE);
  assert.equal(h.idle.fired, 0);
  h.tick(1);
  assert.equal(h.idle.fired, 1);

  const reason = 'server stopped after 3 idle seconds';
  const end = h.lines().at(-1);
  assert.equal(end.type, 'end');
  assert.equal(end.reason, reason);
  assert.ok(header(end.transcript).endsWith(` (${reason})`));
  const gone = await call('POST', `${agent.link}/post`, { text: 'late' });
  assert.equal(gone.status, 410);
  assert.equal(gone.json.transcript, end.transcript);
  h.tick(IDLE * 2);
  assert.equal(h.idle.fired, 1);
});

test('the idle time reads in minutes: 30 by default, 1 in the singular', async () => {
  for (const [serverIdleMs, reason] of [
    [undefined, 'server stopped after 30 idle minutes'],
    [60000, 'server stopped after 1 idle minute'],
  ]) {
    clock();
    const h = await server({ serverIdleMs });
    await h.room();
    h.tick((serverIdleMs ?? 1800000) + 1);
    assert.equal(h.idle.fired, 1);
    assert.equal(h.lines().at(-1).reason, reason);
    mock.timers.reset();
  }
});

test('agent calls other than wait keep the server running', async () => {
  clock();
  const h = await server();
  const { agent } = await h.room();
  for (let i = 0; i < 6; i++) {
    h.tick(IDLE / 2);
    assert.equal((await call(i % 2 ? 'GET' : 'POST', `${agent.link}/${i % 2 ? 'read' : 'post'}`, i % 2 ? undefined : { text: `beat ${i}` })).status, 200);
    h.huddle.sweep();
    assert.equal(h.idle.fired, 0);
  }
  h.tick(IDLE + 1);
  assert.equal(h.idle.fired, 1);
});

test('a declared working window holds the server until it passes', async () => {
  clock();
  const h = await server();
  const { agent } = await h.room();
  assert.equal((await call('POST', `${agent.link}/post`, { text: 'long job', workingMinutes: 1 })).status, 200);
  h.tick(60000 + IDLE);
  assert.equal(h.idle.fired, 0);
  h.tick(1);
  assert.equal(h.idle.fired, 1);
});

test('page polls, parked waits, rest checks, health and admin listings do not keep the server running', async () => {
  clock();
  const h = await server();
  const { created, agent } = await h.room();
  const parked = call('GET', `${agent.link}/wait?wait=5`);
  for (let i = 0; i < 2; i++) {
    h.tick(IDLE / 2);
    await call('GET', `${created.page}/api/state`);
    await call('GET', `${agent.link}/me?rest=1`);
    await call('GET', `${h.base}/health`);
    await call('GET', `${h.base}/admin/rooms`, undefined, { authorization: 'Bearer admin' });
  }
  assert.equal(h.idle.fired, 0);
  h.tick(1);
  assert.equal(h.idle.fired, 1);
  const gone = await parked;
  assert.equal(gone.status, 410);
  assert.ok(gone.json.transcript);
});

test('your posts, opening the page and the file list keep the server running', async () => {
  clock();
  const h = await server();
  const { created } = await h.room();
  const actions = [
    () => call('POST', `${created.page}/api/post`, { text: 'still here' }),
    () => call('GET', created.page),
    () => call('GET', `${created.page}/api/files`),
  ];
  for (let i = 0; i < 6; i++) {
    h.tick(IDLE / 2);
    assert.equal((await actions[i % actions.length]()).status, 200);
    h.huddle.sweep();
    assert.equal(h.idle.fired, 0);
  }
});

test('an empty server idles out', async () => {
  clock();
  const h = await server();
  h.tick(IDLE + 1);
  assert.equal(h.idle.fired, 1);
  assert.deepEqual(h.files('.jsonl'), []);
});

test('close ends every live room with the reason server stopped, and skips ended rooms', async () => {
  const h = await server({ serverIdleMs: 60000 });
  const { agent } = await h.room();
  const done = await h.room();
  await call('POST', `${h.base}/admin/rooms/${done.created.id}/end`, undefined, { authorization: 'Bearer admin' });
  const parked = call('GET', `${agent.link}/wait?wait=5`);
  await sleep(50);
  await h.huddle.close();

  const gone = await parked;
  assert.equal(gone.status, 410);
  const ends = h.files('.jsonl').map((f) => fs.readFileSync(f, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l)).filter((l) => l.type === 'end'));
  const live = ends.find((e) => e[0].reason);
  const ended = ends.find((e) => !e[0].reason);
  assert.equal(live.length, 1);
  assert.equal(live[0].reason, 'server stopped');
  assert.ok(header(live[0].transcript).endsWith(' (server stopped)'));
  assert.equal(ended.length, 1);
  assert.equal(ended[0].reason, undefined);
  assert.equal(h.idle.fired, 0);
});
