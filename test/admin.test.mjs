import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const TOKEN = 'test-admin-token';
const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function start(opts = {}) {
  const huddle = createHuddle({ adminToken: TOKEN, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  return { base: `http://127.0.0.1:${port}`, port };
}

async function call(method, url, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

const admin = (base, method, route, ...rest) =>
  call(method, `${base}/admin/${route}`, { token: rest.length ? rest[0] : TOKEN });

async function room(title) {
  const ctx = await start();
  const { json: created } = await call('POST', `${ctx.base}/new`, { body: { title } });
  const { json: agent } = await call('POST', `${created.join}/join`, { body: { harness: 'claude' } });
  return { ...ctx, created, agent };
}

test('admin routes require the bearer token', async () => {
  const { base } = await start();
  for (const token of [undefined, 'wrong', '']) {
    const res = await admin(base, 'GET', 'sessions', token);
    assert.equal(res.status, 401, String(token));
    assert.equal((await admin(base, 'POST', 'sessions/x/end', token)).status, 401);
  }
});

test('admin is disabled when the server has no admin token', async () => {
  const huddle = createHuddle();
  const port = await huddle.listen(0);
  running.push(huddle);
  const res = await admin(`http://127.0.0.1:${port}`, 'GET', 'sessions', 'undefined');
  assert.equal(res.status, 401);
});

test('admin routes reject a foreign Host', async () => {
  const { port } = await start();
  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/admin/sessions', headers: { host: 'evil.example', authorization: `Bearer ${TOKEN}` } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
});

test('list shows live sessions newest first with counts and URLs', async () => {
  const { base } = await start();
  const a = (await call('POST', `${base}/new`, { body: { title: 'first' } })).json;
  const b = (await call('POST', `${base}/new`, { body: { title: 'second' } })).json;
  await call('POST', `${a.join}/join`, { body: { harness: 'claude' } });
  await call('POST', `${a.join}/join`, { body: { harness: 'codex' } });
  const { status, json } = await admin(base, 'GET', 'sessions');
  assert.equal(status, 200);
  assert.deepEqual(json.sessions.map((s) => s.title), ['second', 'first']);
  const first = json.sessions[1];
  assert.equal(first.id, a.id);
  assert.deepEqual(first.agents, { active: 2, total: 2 });
  assert.equal(first.messages, 2);
  assert.equal(first.join, a.join);
  assert.equal(first.page, a.page);
  assert.ok(Date.parse(first.createdAt));
  assert.equal(json.sessions[0].id, b.id);
  assert.deepEqual(json.sessions[0].agents, { active: 0, total: 0 });
});

test('ending a session releases waiting agents with 410', async () => {
  const r = await room('doomed');
  const wait = call('GET', `${r.agent.link}/wait?wait=30`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const started = Date.now();
  const end = await admin(r.base, 'POST', `sessions/${r.created.id}/end`);
  assert.deepEqual(end.json, { id: r.created.id, title: 'doomed', ended: true });
  const waited = await wait;
  assert.equal(waited.status, 410);
  assert.equal(waited.json.error, 'huddle ended');
  assert.ok(Date.now() - started < 2000);
});

test('an ended session answers 410 on every agent and human route', async () => {
  const r = await room('doomed');
  await admin(r.base, 'POST', `sessions/${r.created.id}/end`);
  const gone = { error: 'huddle ended' };
  for (const [method, url, body] of [
    ['POST', `${r.agent.link}/post`, { text: 'hi' }],
    ['GET', `${r.agent.link}/read`],
    ['GET', `${r.agent.link}/tasks`],
    ['POST', `${r.agent.link}/tasks`, { title: 'x' }],
    ['POST', `${r.created.join}/join`, { harness: 'codex' }],
    ['GET', `${r.created.page}/api/state`],
    ['POST', `${r.created.page}/api/post`, { text: 'hi' }],
    ['POST', `${r.created.page}/api/tasks`, { title: 'x' }],
  ]) {
    const res = await call(method, url, { body });
    assert.equal(res.status, 410, `${method} ${url}`);
    assert.deepEqual(res.json, gone);
  }
  const proto = await call('GET', r.created.join);
  assert.equal(proto.status, 410);
  assert.equal(proto.text, 'This huddle has ended.');
});

test('ended sessions leave the list and cannot be ended again', async () => {
  const r = await room('doomed');
  await admin(r.base, 'POST', `sessions/${r.created.id}/end`);
  assert.deepEqual((await admin(r.base, 'GET', 'sessions')).json.sessions, []);
  assert.equal((await admin(r.base, 'POST', `sessions/${r.created.id}/end`)).status, 404);
  assert.equal((await admin(r.base, 'POST', 'sessions/nope/end')).status, 404);
});

test('tombstones are deleted after the TTL', async () => {
  const { base } = await start({ tombstoneMs: 50 });
  const created = (await call('POST', `${base}/new`, { body: {} })).json;
  await admin(base, 'POST', `sessions/${created.id}/end`);
  assert.equal((await call('GET', created.join)).status, 410);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal((await call('GET', created.join)).status, 404);
});

// ---- CLI ----

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-admin-'));
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

after(async () => {
  if (env) await cli('down');
  fs.rmSync(home, { recursive: true, force: true });
});

test('cli: ls, open and end without a running server', async () => {
  env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
  const ls = await cli('ls');
  assert.equal(ls.code, 0);
  assert.match(ls.stdout, /No huddle server is running\./);
  for (const args of [['open', '--print'], ['end', 'x']]) {
    const res = await cli(...args);
    assert.equal(res.code, 1, args.join(' '));
    assert.match(res.stderr, /No huddle server is running\./);
  }
});

test('cli: session management end to end', async () => {
  const alpha = JSON.parse((await cli('new', 'alpha')).stdout);
  const beta = JSON.parse((await cli('new', 'beta')).stdout);
  const info = JSON.parse(fs.readFileSync(path.join(home, 'server.json'), 'utf8'));
  assert.ok(info.adminToken);
  assert.equal(fs.statSync(path.join(home, 'server.json')).mode & 0o777, 0o600);

  const ls = await cli('ls');
  assert.equal(ls.code, 0, ls.stderr);
  assert.match(ls.stdout, /TITLE\s+ID\s+AGENTS\s+AGE\s+PAGE/);
  assert.match(ls.stdout, new RegExp(`alpha\\s+${alpha.id.slice(0, 8)}\\s+0/0`));
  assert.match(ls.stdout, new RegExp(`beta\\s+${beta.id.slice(0, 8)}`));
  assert.ok(ls.stdout.includes(`    join: ${beta.join}`));

  const json = JSON.parse((await cli('ls', '--json')).stdout);
  assert.deepEqual(json.map((s) => s.title), ['beta', 'alpha']);

  const open = await cli('open', '--print', 'bet');
  assert.equal(open.code, 0, open.stderr);
  assert.equal(open.stdout.trim(), beta.page);
  assert.equal((await cli('open', '--print')).stdout.trim(), beta.page);

  await cli('new', 'alpha two');
  const ambiguous = await cli('open', '--print', 'alp');
  assert.equal(ambiguous.code, 1);
  assert.match(ambiguous.stderr, /alpha two/);
  assert.equal((await cli('end', 'nothing-like-this')).code, 1);
  assert.equal((await cli('end')).code, 1);

  const end = await cli('end', 'alpha');
  assert.equal(end.code, 0, end.stderr);
  assert.equal(end.stdout.trim(), `Ended "alpha" (${alpha.id.slice(0, 8)})`);
  const after1 = JSON.parse((await cli('ls', '--json')).stdout);
  assert.deepEqual(after1.map((s) => s.title), ['alpha two', 'beta']);

  const all = await cli('end', '--all');
  assert.equal(all.code, 0, all.stderr);
  assert.match((await cli('ls')).stdout, /No live huddles\./);
});
