import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function call(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const REASON = 'ties sort by count only; the brief says alphabetical';

// claude-1 finished #1 "wordfreq CLI" with a note; #2 is open; claude-2 is a second agent.
async function room() {
  const huddle = createHuddle({ adminToken: 'admin' });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const created = (await call('POST', `${base}/new`, { name: 'reopen' })).json;
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const c1 = await join('claude');
  const c2 = await join('claude');
  await call('POST', `${c1.link}/tasks`, { title: 'wordfreq CLI' });
  await call('POST', `${c1.link}/tasks`, { title: 'docs' });
  await call('POST', `${c1.link}/tasks/1/claim`);
  await call('POST', `${c1.link}/tasks/1/done`, { note: 'saved to wordfreq.mjs' });
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const task = async (n) => (await call('GET', `${c1.link}/tasks`)).json.tasks.find((t) => t.id === n);
  return { base, created, c1, c2, state, task };
}

test('AC-84: a done task reopens with a reason, goes back to its owner and wakes them', async () => {
  const r = await room();
  const parked = call('GET', `${r.c1.link}/wait?wait=25`);
  await new Promise((res) => setTimeout(res, 100));
  const res = await call('POST', `${r.c2.link}/tasks/1/reopen`, { reason: REASON });
  assert.equal(res.status, 200, JSON.stringify(res.json));

  const t = await call('GET', `${r.c1.link}/tasks/1`);
  assert.equal(t.json.status, 'claimed');
  assert.equal(t.json.owner, 'claude-1');
  assert.equal(t.json.note, 'saved to wordfreq.mjs');
  const stored = (await r.state()).tasks.find((x) => x.id === 1);
  assert.equal(stored.reopened.by, 'claude-2');
  assert.equal(stored.reopened.reason, REASON);

  const text = `claude-2 reopened task #1 "wordfreq CLI": ${REASON}`;
  const msg = (await r.state()).messages.filter((m) => m.text === text);
  assert.equal(msg.length, 1);
  assert.deepEqual(msg[0].to, ['claude-1']);
  assert.deepEqual(msg[0].mentions, ['claude-1']);

  const woken = await parked;
  assert.equal(woken.status, 200);
  assert.ok(woken.json.messages.some((m) => m.text === text));

  assert.match(await (await fetch(r.c1.link)).text(), /tasks\/1\/reopen/);
});

test('AC-85: a missing or blank reason is refused and nothing changes', async () => {
  const r = await room();
  const before = (await r.state()).messages.length;
  for (const body of [{}, { reason: '   ' }]) {
    const res = await call('POST', `${r.c2.link}/tasks/1/reopen`, body);
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'invalid_text');
    assert.match(res.json.message, /reason/);
  }
  assert.equal((await call('GET', `${r.c1.link}/tasks/1`)).json.status, 'done');
  assert.equal((await call('GET', `${r.c1.link}/tasks/1`)).json.note, 'saved to wordfreq.mjs');
  assert.equal((await r.state()).messages.length, before);
  const read = await call('GET', `${r.c1.link}/read?limit=500`);
  assert.ok(!read.json.messages.some((m) => /reopened/.test(m.text)));
});

test('AC-86: only a done task reopens, and only in a live room', async () => {
  const r = await room();
  await call('POST', `${r.c2.link}/tasks/2/claim`);
  const claimed = await call('POST', `${r.c1.link}/tasks/2/reopen`, { reason: REASON });
  assert.equal(claimed.status, 409);
  assert.equal(claimed.json.error, 'not_done');
  assert.match(claimed.json.message, /claimed/);
  assert.equal((await r.task(2)).status, 'claimed');
  assert.equal((await r.task(2)).owner, 'claude-2');

  await call('POST', `${r.c2.link}/tasks/2/release`);
  const open = await call('POST', `${r.c1.link}/tasks/2/reopen`, { reason: REASON });
  assert.equal(open.status, 409);
  assert.match(open.json.message, /open/);
  assert.equal((await r.task(2)).status, 'open');
  assert.equal((await r.task(2)).owner, null);

  const unknown = await call('POST', `${r.c1.link}/tasks/9/reopen`, { reason: REASON });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.json.error, 'unknown_task');

  await call('POST', `${r.base}/admin/rooms/${r.created.id}/end`, undefined, { authorization: 'Bearer admin' });
  const ended = await call('POST', `${r.c2.link}/tasks/1/reopen`, { reason: REASON });
  assert.equal(ended.status, 410);
  assert.equal(ended.json.error, 'room_ended');
  const page = await call('POST', `${r.created.page}/api/tasks/1/reopen`, { reason: REASON });
  assert.equal(page.status, 410);
});

test('a task whose owner left reopens as open and wakes nobody', async () => {
  const r = await room();
  await call('POST', `${r.c1.link}/leave`);
  const res = await call('POST', `${r.c2.link}/tasks/1/reopen`, { reason: REASON });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const t = await call('GET', `${r.c2.link}/tasks/1`);
  assert.equal(t.json.status, 'open');
  assert.equal(t.json.owner, null);
  const msg = (await r.state()).messages.find((m) => /reopened task #1/.test(m.text));
  assert.deepEqual(msg.to, []);
});

test('the page reopens as you and resets the agent streak', async () => {
  const r = await room();
  await call('POST', `${r.c2.link}/post`, { text: 'hello' });
  assert.ok((await r.state()).agentStreak > 0);
  const res = await call('POST', `${r.created.page}/api/tasks/1/reopen`, { reason: REASON });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const state = await r.state();
  assert.equal(state.agentStreak, 0);
  assert.equal(state.tasks.find((x) => x.id === 1).reopened.by, 'you');
  const msg = state.messages.find((m) => /reopened task #1/.test(m.text));
  assert.equal(msg.text, `you reopened task #1 "wordfreq CLI": ${REASON}`);
  assert.deepEqual(msg.to, ['claude-1']);
});

test('a task you marked done reopens as open for its assignee, who is told', async () => {
  const r = await room();
  await call('POST', `${r.created.page}/api/tasks/2/assign`, { assignee: 'claude-2' });
  assert.equal((await r.task(2)).assignee, 'claude-2');
  await call('POST', `${r.created.page}/api/tasks/2/done`, { note: 'done by hand' });
  const res = await call('POST', `${r.created.page}/api/tasks/2/reopen`, { reason: REASON });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.deepEqual([res.json.status, res.json.owner, res.json.assignee], ['open', null, 'claude-2']);
  const msg = (await r.state()).messages.find((m) => /reopened task #2/.test(m.text));
  assert.deepEqual(msg.to, ['claude-2']);
  assert.deepEqual(msg.mentions, ['claude-2']);
});

test('a reopen blocks a claimed task after it, and its owner hears when it is ready again', async () => {
  const r = await room();
  await call('POST', `${r.c1.link}/tasks`, { title: 'review', after: [1] });
  assert.equal((await call('POST', `${r.c2.link}/tasks/3/claim`)).status, 200);
  await call('POST', `${r.c2.link}/tasks/1/reopen`, { reason: REASON });
  await call('GET', `${r.c2.link}/read?limit=500`);

  const blocked = await call('POST', `${r.c2.link}/tasks/3/done`, { note: 'reviewed' });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.error, 'task_blocked');
  assert.equal((await r.task(3)).status, 'claimed');

  await call('POST', `${r.c1.link}/tasks/1/done`, { note: 'ties sort alphabetically' });
  const read = await call('GET', `${r.c2.link}/read?limit=500`);
  const ready = read.json.messages.filter((m) => m.text === 'Task #3 "review" is ready: #1 is done.');
  assert.equal(ready.length, 1);
  assert.deepEqual(ready[0].to, ['claude-2']);
  assert.deepEqual(ready[0].mentions, ['claude-2']);
});

test('a done task after a reopened one is not blocked; open and claimed tasks after it are', async () => {
  const r = await room();
  await call('POST', `${r.c1.link}/tasks`, { title: 'review', after: [1] });
  await call('POST', `${r.c1.link}/tasks`, { title: 'release', after: [1] });
  await call('POST', `${r.c1.link}/tasks`, { title: 'publish', after: [1] });
  await call('POST', `${r.c2.link}/tasks/3/claim`);
  await call('POST', `${r.c2.link}/tasks/3/done`, { note: 'reviewed' });
  await call('POST', `${r.c2.link}/tasks/4/claim`);
  await call('POST', `${r.c2.link}/tasks/1/reopen`, { reason: REASON });

  assert.deepEqual((await r.task(3)).blocked, []);
  assert.equal((await r.task(3)).status, 'done');
  assert.deepEqual((await r.task(4)).blocked, [1]);
  assert.deepEqual((await r.task(5)).blocked, [1]);
  assert.deepEqual((await r.state()).tasks.find((t) => t.id === 3).blocked, []);
});
