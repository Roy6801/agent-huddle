import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHuddle, readHomeKey } from '../skills/agent-huddle/huddle.mjs';

const running = [];
const dirs = [];
afterEach(async () => {
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
  return { status: res.status, type: res.headers.get('content-type'), text, json };
}

// fetch drops a Host header it is given, so a rebound host goes through http.request.
function withHost(url, host) {
  const { port, pathname } = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, headers: { host, connection: 'close' } }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end();
  });
}

const tmpDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-home-'));
  dirs.push(dir);
  return dir;
};

const KEY = 'home-key-for-tests';

async function serve(historyDir, opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', homeKey: KEY, historyDir, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  return { huddle, base, home: `${base}/home/${KEY}` };
}

async function room(base, name) {
  const created = (await call('POST', `${base}/new`, { name })).json;
  const lead = (await call('POST', `${created.join}/join`, { harness: 'codex', lead: created.lead })).json;
  const agent = (await call('POST', `${created.join}/join`, { harness: 'claude' })).json;
  await call('POST', `${agent.link}/post`, { text: `hello from ${name}` });
  return { created, keys: [created.lead, lead.link.split('/as/')[1], agent.link.split('/as/')[1]] };
}

const end = (base, id) => call('POST', `${base}/admin/rooms/${id}/end`, undefined, { authorization: 'Bearer admin' });

test('AC-30.1: the home lists live rooms with their page and past rooms with how they ended, newest first, no keys', async () => {
  const dir = tmpDir();
  const { base, home } = await serve(dir);
  const first = await room(base, 'first');
  await new Promise((r) => setTimeout(r, 5));
  const second = await room(base, 'second');
  await new Promise((r) => setTimeout(r, 5));
  const third = await room(base, 'third');
  await end(base, first.created.id);

  const page = await call('GET', home);
  assert.equal(page.status, 200);
  assert.match(page.type, /text\/html/);

  const { status, json, text } = await call('GET', `${home}/api/rooms`);
  assert.equal(status, 200);
  assert.deepEqual(json.live.map((r) => r.name), ['third', 'second']);
  const live = json.live[0];
  assert.equal(live.id, third.created.id.slice(0, 8));
  assert.deepEqual(live.agents, { active: 2, total: 2 });
  assert.ok(live.createdAt);
  assert.equal(`${base}${live.page}`, third.created.page);

  assert.deepEqual(json.past.map((r) => r.name), ['first']);
  const past = json.past[0];
  assert.equal(past.id, first.created.id.slice(0, 8));
  assert.ok(past.ended.at);
  assert.equal(past.ended.reason, null);
  assert.match(past.transcript, /first-.{8}\.md$/);
  assert.ok(fs.existsSync(past.transcript));
  assert.match(past.page, new RegExp(`^/home/${KEY}/rooms/[\\w-]+-${past.id}$`));

  for (const { keys } of [first, second, third]) for (const k of keys) assert.ok(!text.includes(k), 'no lead or agent key');
  assert.ok(!text.includes(first.created.page.split('/h/')[1]), 'no page key of a past room');
});

test('AC-30.1: past rooms include rooms gone from memory and not-ended history, newest first', async () => {
  const dir = tmpDir();
  const before = await serve(dir);
  await room(before.base, 'stopped by server');
  await before.huddle.close();
  running.pop();
  fs.writeFileSync(path.join(dir, '2020-01-01-crashed-abcdef12.jsonl'),
    JSON.stringify({ type: 'room', at: '2020-01-01T10:00:00.000Z', name: 'crashed', id: 'abcdef12', createdAt: '2020-01-01T10:00:00.000Z' }) + '\n');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not history');

  const { home } = await serve(dir);
  const { json } = await call('GET', `${home}/api/rooms`);
  assert.deepEqual(json.live, []);
  assert.deepEqual(json.past.map((r) => [r.name, r.ended?.reason ?? null]), [['stopped by server', 'server stopped'], ['crashed', null]]);
  assert.equal(json.past[1].ended, null);
  assert.match(json.past[1].transcript, /crashed-abcdef12\.jsonl$/);
});

test('AC-30.2: a wrong home key gets nothing, / has no links, and other sites are refused', async () => {
  const dir = tmpDir();
  const { base, home } = await serve(dir);
  const { created } = await room(base, 'secret');

  for (const url of [`${base}/home/wrong`, `${base}/home/wrong/api/rooms`, `${base}/home`, `${base}/home/${KEY}x/api/rooms`]) {
    const r = await call('GET', url);
    assert.equal(r.status, 401, url);
    assert.equal(r.json.error, 'wrong_home_link');
    assert.ok(!r.text.includes(created.id));
  }

  const root = await call('GET', `${base}/`);
  assert.equal(root.status, 200);
  assert.match(root.text, /home/);
  assert.ok(!root.text.includes(created.id) && !root.text.includes(KEY));

  const foreign = await call('GET', `${home}/api/rooms`, undefined, { origin: 'http://evil.example' });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.json.error, 'forbidden_origin');
  const rebound = await withHost(`${home}/api/rooms`, `evil.example:${new URL(base).port}`);
  assert.equal(rebound.status, 403);
  assert.equal(rebound.json.error, 'forbidden_host');

  assert.equal((await call('POST', `${home}/api/rooms`, {})).status, 404);
});

test('AC-30.2: a server without a home key has no home page', async () => {
  const { base } = await serve(tmpDir(), { homeKey: undefined });
  const r = await call('GET', `${base}/home/anything/api/rooms`);
  assert.equal(r.status, 404);
});

test('AC-30.3: a past room opens from the home read-only, also history from before the page hash', async () => {
  const dir = tmpDir();
  const { base, home } = await serve(dir);
  const { created, keys } = await room(base, 'done room');
  await end(base, created.id);
  const old = '2020-01-01-old-room-0123abcd';
  fs.writeFileSync(path.join(dir, `${old}.jsonl`), [
    { type: 'room', at: '2020-01-01T10:00:00.000Z', name: 'old room', id: '0123abcd', createdAt: '2020-01-01T10:00:00.000Z' },
    { type: 'message', at: '2020-01-01T10:01:00.000Z', id: 1, from: 'codex-1', text: 'old hello', files: [] },
    { type: 'end', at: '2020-01-01T11:00:00.000Z', transcript: null },
  ].map((l) => JSON.stringify(l)).join('\n') + '\n');

  const { json } = await call('GET', `${home}/api/rooms`);
  const done = `${base}${json.past.find((r) => r.name === 'done room').page}`;
  const page = await call('GET', done);
  assert.equal(page.status, 200);
  assert.match(page.type, /text\/html/);
  const history = await call('GET', `${done}/api/history`);
  assert.equal(history.status, 200);
  assert.equal(history.json.room.name, 'done room');
  assert.ok(history.json.messages.some((m) => m.text === 'hello from done room'));
  for (const k of keys) assert.ok(!history.text.includes(k));
  const state = await call('GET', `${done}/api/state`);
  assert.equal(state.status, 410);
  assert.equal(state.json.error, 'room_ended');
  assert.match(state.json.transcript, /done-room-.{8}\.md$/);
  assert.equal((await call('POST', `${done}/api/post`, { text: 'hi' })).status, 410);

  const oldView = await call('GET', `${home}/rooms/${old}/api/history`);
  assert.equal(oldView.json.room.name, 'old room');
  assert.deepEqual(oldView.json.messages.map((m) => m.text), ['old hello']);
});

test('AC-30.3: only listed past rooms open; a live room, an unknown name and a path escape are not found', async () => {
  const dir = tmpDir();
  const { base, home } = await serve(dir);
  await room(base, 'still live');
  const live = fs.readdirSync(dir).find((n) => n.endsWith('.jsonl')).replace(/\.jsonl$/, '');
  fs.writeFileSync(path.join(path.dirname(dir), `${path.basename(dir)}-outside.jsonl`), '{}\n');
  dirs.push(path.join(path.dirname(dir), `${path.basename(dir)}-outside.jsonl`));

  for (const name of [live, 'nope', `..%2F${path.basename(dir)}-outside`]) {
    const r = await call('GET', `${home}/rooms/${name}/api/history`);
    assert.equal(r.status, 404, name);
  }
  assert.equal((await call('GET', `${home}/rooms`)).status, 404);
});

test('AC-30.4: the home key is created once, owner-only, and read back the same', () => {
  const home = tmpDir();
  const key = readHomeKey(home);
  assert.match(key, /^[\w-]{20,}$/);
  assert.equal(readHomeKey(home), key);
  assert.equal(fs.statSync(path.join(home, 'home-key')).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(home), ['home-key']);
});
