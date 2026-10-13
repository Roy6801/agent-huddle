import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHuddle } from '../huddle.mjs';

let huddle;
let port;
let created;

function raw(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: { connection: 'close', ...headers } }, (res) => {
      let text = '';
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

before(async () => {
  huddle = createHuddle();
  port = await huddle.listen(0);
  const res = await raw('/new', {
    method: 'POST',
    headers: { host: `127.0.0.1:${port}`, 'content-type': 'application/json' },
    body: '{}',
  });
  created = JSON.parse(res.text);
});

after(() => huddle.close());

const goodHost = () => ({ host: `127.0.0.1:${port}` });
const sessionPath = () => new URL(created.join).pathname;

test('wrong Host is rejected with 403 and leaks nothing', async () => {
  for (const host of ['evil.example', `evil.example:${port}`, '127.0.0.1:1', 'localhost']) {
    const res = await raw(sessionPath(), { headers: { host } });
    assert.equal(res.status, 403, host);
    assert.ok(!res.text.includes(created.id));
  }
  assert.equal((await raw('/health', { headers: { host: `evil.example:${port}` } })).status, 403);
});

test('localhost Host is accepted and echoed in absolute URLs', async () => {
  const res = await raw('/new', {
    method: 'POST',
    headers: { host: `localhost:${port}`, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 200);
  assert.ok(JSON.parse(res.text).join.startsWith(`http://localhost:${port}/s/`));
});

test('foreign Origin is rejected with 403', async () => {
  const bad = await raw('/health', { headers: { ...goodHost(), origin: 'http://evil.example' } });
  assert.equal(bad.status, 403);
  const wrongPort = await raw('/health', { headers: { ...goodHost(), origin: 'http://127.0.0.1:1' } });
  assert.equal(wrongPort.status, 403);
  const good = await raw('/health', { headers: { ...goodHost(), origin: `http://localhost:${port}` } });
  assert.equal(good.status, 200);
});

test('unknown agent and human tokens get 401, unknown session 404', async () => {
  const agent = await raw(`${sessionPath()}/as/not-a-token/me`, { headers: goodHost() });
  assert.equal(agent.status, 401);
  const agentPost = await raw(`${sessionPath()}/as/not-a-token/post`, {
    method: 'POST',
    headers: { ...goodHost(), 'content-type': 'application/json' },
    body: '{"text":"hi"}',
  });
  assert.equal(agentPost.status, 401);
  const human = await raw(`${sessionPath()}/h/not-a-token/api/state`, { headers: goodHost() });
  assert.equal(human.status, 401);
  const noSession = await raw('/s/nope/as/x/me', { headers: goodHost() });
  assert.equal(noSession.status, 404);
  const noSessionJoin = await raw('/s/nope', { headers: goodHost() });
  assert.equal(noSessionJoin.status, 404);
});

test('ids and tokens are 128-bit random', () => {
  assert.match(created.id, /^[A-Za-z0-9_-]{22}$/);
  assert.match(created.page.split('/h/')[1], /^[A-Za-z0-9_-]{22}$/);
});

test('body over 64 KB is 413, bad JSON is 400', async () => {
  const big = await raw('/new', {
    method: 'POST',
    headers: { ...goodHost(), 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x'.repeat(70 * 1024) }),
  });
  assert.equal(big.status, 413);
  const bad = await raw('/new', {
    method: 'POST',
    headers: { ...goodHost(), 'content-type': 'application/json' },
    body: '{nope',
  });
  assert.equal(bad.status, 400);
  const nonObject = await raw('/new', {
    method: 'POST',
    headers: { ...goodHost(), 'content-type': 'application/json' },
    body: '[1]',
  });
  assert.equal(nonObject.status, 400);
});
