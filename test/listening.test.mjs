import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const QUIET = 50;

async function room(opts = {}) {
  const huddle = createHuddle({ quietMs: QUIET, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const { json: created } = await call('POST', `${base}/new`, { name: 'test room' });
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const human = (path, body) => call(body ? 'POST' : 'GET', `${created.page}/${path}`, body);
  const presence = async (handle) =>
    (await human('api/state')).json.agents.find((a) => a.handle === handle).presence;
  const notices = async () =>
    (await human('api/state')).json.messages.filter((m) => m.kind === 'system' && /listening|working|asleep/i.test(m.text));
  return { created, join, human, notices, presence };
}

test('quiet mentioned agent gets one notice shown to the human', async () => {
  const r = await room();
  await r.join('codex');
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@codex-1 ping' });
  const notices = await r.notices();
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /^codex-1 is working \(last seen <1 min ago\); it will read this when it next waits\./);
  assert.equal(notices[0].toYou, true);
  assert.deepEqual(notices[0].to, []);
});

test('no second notice until the agent makes a request', async () => {
  const r = await room();
  const a = await r.join('codex');
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@codex-1 one' });
  await r.human('api/post', { text: '@codex-1 two' });
  assert.equal((await r.notices()).length, 1);
  await call('GET', `${a.link}/me`);
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@codex-1 three' });
  assert.equal((await r.notices()).length, 2);
});

test('agent waiting gets the message and no notice', async () => {
  const r = await room();
  const a = await r.join('codex');
  await sleep(QUIET + 30);
  const pending = call('GET', `${a.link}/wait?wait=5`);
  await sleep(20);
  await r.human('api/post', { text: '@codex-1 ping' });
  const got = await pending;
  assert.ok(got.json.messages.some((m) => m.text === '@codex-1 ping'));
  assert.equal((await r.notices()).length, 0);
});

test('recently seen agent is not flagged', async () => {
  const r = await room();
  await r.join('codex');
  await r.human('api/post', { text: '@codex-1 ping' });
  assert.equal((await r.notices()).length, 0);
});

test('@all with two quiet agents posts one combined notice', async () => {
  const r = await room();
  await r.join('codex');
  await r.join('opencode');
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@all status?' });
  const notices = await r.notices();
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /^Not listening: codex-1 \(working, <1 min\), opencode-1 \(working, <1 min\)\. Working agents read this/);
});

test('task assigned to a quiet agent posts a notice', async () => {
  const r = await room();
  await r.join('codex');
  await sleep(QUIET + 30);
  await r.human('api/tasks', { title: 'draw sprite', assignee: 'codex-1' });
  const notices = await r.notices();
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /codex-1 is working/);
});

test('an agent is never noticed about its own post', async () => {
  const r = await room();
  const a = await r.join('codex');
  await sleep(QUIET + 30);
  await call('POST', `${a.link}/post`, { text: '@codex-1 note to self' });
  assert.equal((await r.notices()).length, 0);
});

test('human page link 404 hints at the agent join url', async () => {
  const r = await room();
  const res = await r.human('wait');
  assert.equal(res.status, 404);
  assert.ok(res.json.hint.includes(`${r.created.join}`));
  assert.ok(res.json.hint.includes(`${r.created.join}/join`));
});

test('presence: parked wait is listening, other requests are working, aged ones asleep', async () => {
  const r = await room({ activeMs: 150 });
  const a = await r.join('codex');
  assert.equal(await r.presence('codex-1'), 'working');
  const pending = call('GET', `${a.link}/wait?wait=1`);
  await sleep(30);
  assert.equal(await r.presence('codex-1'), 'listening');
  await pending;
  await call('GET', `${a.link}/me`);
  assert.equal(await r.presence('codex-1'), 'working');
  await sleep(200);
  assert.equal(await r.presence('codex-1'), 'asleep');
  assert.equal((await call('GET', `${a.link}/me`)).json.presence, 'working');
  await call('POST', `${a.link}/leave`, {});
  assert.equal(await r.presence('codex-1'), 'left');
});

test('presence: me?rest=1 is asleep until any other request', async () => {
  const r = await room();
  const a = await r.join('codex');
  await call('GET', `${a.link}/me?rest=1`);
  assert.equal(await r.presence('codex-1'), 'asleep');
  await call('GET', `${a.link}/me`);
  assert.equal(await r.presence('codex-1'), 'working');
});

test('an asleep agent gets the nudge copy', async () => {
  const r = await room({ activeMs: 60 });
  await r.join('codex');
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@codex-1 ping' });
  const notices = await r.notices();
  assert.match(notices[0].text, /^codex-1 is asleep \(last seen <1 min ago\)\. If its turn ended, nudge it in its own terminal\.$/);
});

test('a mixed @all notice groups working and asleep agents', async () => {
  const r = await room({ activeMs: 150 });
  await r.join('codex');
  await sleep(QUIET + 130);
  await r.join('opencode');
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@all status?' });
  const notices = await r.notices();
  assert.match(notices[0].text, /^Not listening: codex-1 \(asleep, <1 min\), opencode-1 \(working, <1 min\)\./);
});

test('a headless agent is never noticed', async () => {
  const r = await room();
  await call('POST', `${r.created.join}/join`, { harness: 'codex', role: 'headless' });
  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@codex-1 ping' });
  assert.equal((await r.notices()).length, 0);
});
