import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const OPTIONS = [
  { optionId: 'yes', kind: 'allow_once', name: 'Allow once' },
  { optionId: 'always', kind: 'allow_always', name: 'Always' },
  { optionId: 'no', kind: 'reject_once', name: 'Deny' },
];

async function room(opts = {}) {
  const huddle = createHuddle(opts);
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = await (await fetch(`http://127.0.0.1:${port}/new`, { method: 'POST', body: '{"name":"asks"}' })).json();
  const join = async (harness) =>
    (await fetch(`${created.join}/join`, { method: 'POST', body: JSON.stringify({ harness }) })).json();
  const call = async (method, url, body) => {
    const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };
  const ask = (agent, body = { title: 'run rm -rf build', options: OPTIONS }) => call('POST', `${agent.link}/asks`, body);
  const answer = (n, optionId) => call('POST', `${created.page}/api/asks/${n}`, { optionId });
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  return { created, join, call, ask, answer, state };
}

test('an agent asks, the human answers, the long-poll returns the answer', async () => {
  const { join, call, ask, answer, state } = await room();
  const a = await join('codex');
  const made = await ask(a);
  assert.equal(made.status, 200);
  assert.equal(made.json.id, 1);
  assert.equal(made.json.status, 'open');
  const waiting = call('GET', `${a.link}/asks/1?wait=20`);
  await new Promise((r) => setTimeout(r, 100));
  const started = Date.now();
  assert.equal((await answer(1, 'always')).json.status, 'answered');
  const got = await waiting;
  assert.ok(Date.now() - started < 2000);
  assert.equal(got.json.status, 'answered');
  assert.deepEqual(got.json.answer, { optionId: 'always', kind: 'allow_always' });
  const { messages } = await state();
  assert.ok(messages.some((m) => m.toYou && m.ask === 1 && m.text === `${a.handle} asks: run rm -rf build`));
  assert.ok(messages.some((m) => m.ask === 1 && m.text === 'you always allowed: run rm -rf build'));
});

test('a long-poll on an open ask returns it as open after the wait', async () => {
  const { join, call, ask } = await room();
  const a = await join('codex');
  await ask(a);
  const got = await call('GET', `${a.link}/asks/1?wait=1`);
  assert.equal(got.status, 200);
  assert.equal(got.json.status, 'open');
});

test('bad asks are rejected', async () => {
  const { join, ask } = await room();
  const a = await join('codex');
  const bad = [
    { options: OPTIONS },
    { title: 'x', options: [] },
    { title: 'x', options: Array.from({ length: 7 }, (_, i) => ({ ...OPTIONS[0], optionId: `o${i}` })) },
    { title: 'x', options: [{ ...OPTIONS[0], kind: 'maybe' }] },
    { title: 'x', options: [{ ...OPTIONS[0], name: 'n'.repeat(61) }] },
    { title: 'x'.repeat(301), options: OPTIONS },
  ];
  for (const body of bad) assert.equal((await ask(a, body)).status, 400, JSON.stringify(body).slice(0, 80));
});

test('only the asking agent can read an ask', async () => {
  const { join, call, ask } = await room();
  const a = await join('codex');
  const b = await join('claude');
  await ask(a);
  assert.equal((await call('GET', `${b.link}/asks/1?wait=1`)).status, 404);
});

test('answering twice is 409, an unknown option is 400, an unknown ask is 404', async () => {
  const { join, ask, answer } = await room();
  const a = await join('codex');
  await ask(a);
  assert.equal((await answer(1, 'nope')).status, 400);
  assert.equal((await answer(2, 'yes')).status, 404);
  assert.equal((await answer(1, 'no')).status, 200);
  assert.equal((await answer(1, 'yes')).status, 409);
});

test('an agent link has no route to answer', async () => {
  const { join, call, ask } = await room();
  const a = await join('codex');
  await ask(a);
  assert.equal((await call('POST', `${a.link}/api/asks/1`, { optionId: 'yes' })).status, 404);
  assert.equal((await call('POST', `${a.link}/asks/1`, { optionId: 'yes' })).status, 404);
  assert.equal((await call('GET', `${a.link}/asks/1?wait=1`)).json.status, 'open');
});

test('an unanswered ask times out as denied', async () => {
  const { join, call, ask, state } = await room({ askMs: 150 });
  const a = await join('codex');
  await ask(a);
  const got = await call('GET', `${a.link}/asks/1?wait=10`);
  assert.equal(got.json.status, 'timeout');
  assert.ok((await state()).messages.some((m) => m.text === 'run rm -rf build timed out — denied'));
});

test('leaving cancels open asks and wakes the long-poll', async () => {
  const { join, call, ask, state } = await room();
  const a = await join('codex');
  await ask(a);
  const waiting = call('GET', `${a.link}/asks/1?wait=20`);
  await new Promise((r) => setTimeout(r, 100));
  await call('POST', `${a.link}/leave`, {});
  assert.equal((await waiting).json.status, 'cancelled');
  assert.equal((await state()).asks[0].status, 'cancelled');
});

test('ending the room cancels open asks and wakes the long-poll with 410', async () => {
  const { created, join, call, ask } = await room({ adminToken: 'test-admin-token' });
  const a = await join('codex');
  await ask(a);
  const waiting = call('GET', `${a.link}/asks/1?wait=20`);
  await new Promise((r) => setTimeout(r, 100));
  const end = await fetch(`${new URL(created.join).origin}/admin/rooms/${created.id}/end`, { method: 'POST', headers: { authorization: 'Bearer test-admin-token' } });
  assert.equal(end.status, 200);
  assert.equal((await waiting).status, 410);
});

test('an agent cancels its own open ask', async () => {
  const { join, call, ask, state } = await room();
  const a = await join('codex');
  const b = await join('claude');
  await ask(a);
  assert.equal((await call('POST', `${b.link}/asks/1/cancel`, {})).status, 404);
  const waiting = call('GET', `${a.link}/asks/1?wait=20`);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await call('POST', `${a.link}/asks/1/cancel`, {})).json.status, 'cancelled');
  assert.equal((await waiting).json.status, 'cancelled');
  assert.equal((await call('POST', `${a.link}/asks/1/cancel`, {})).status, 409);
  assert.equal((await call('POST', `${a.link}/asks/2/cancel`, {})).status, 404);
  assert.ok((await state()).messages.some((m) => m.ask === 1 && m.text === 'run rm -rf build cancelled'));
});

test('answering an ask resets the round cap streak and resumes a paused room', async () => {
  const { join, call, ask, answer, state } = await room({ roundCap: 30 });
  const a = await join('codex');
  assert.equal((await ask(a)).status, 200);
  for (let i = 0; i < 30; i++) assert.equal((await call('POST', `${a.link}/post`, { text: `chat ${i}` })).status, 200);
  assert.equal((await call('POST', `${a.link}/post`, { text: 'chat 31' })).status, 429);
  assert.equal((await state()).agentStreak, 30);
  assert.equal((await answer(1, 'yes')).status, 200);
  assert.equal((await state()).agentStreak, 0);
  assert.equal((await call('POST', `${a.link}/post`, { text: 'chat 31' })).status, 200);
});
