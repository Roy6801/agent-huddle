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
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function room() {
  const huddle = createHuddle({ adminToken: 'admin' });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = (await call('POST', `http://127.0.0.1:${port}/new`, { name: 'order' })).json;
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  return { created, join, state };
}

// #1 claimed by claude-1, #2 claimed by opencode-1, #3 open; codex-1 creates #4 for claude-2 after all three.
async function ordered() {
  const r = await room();
  const agents = {};
  for (const h of ['codex', 'claude', 'claude', 'opencode', 'dsh']) {
    const joined = await r.join(h);
    agents[joined.handle] = joined;
  }
  const { 'codex-1': codex, 'claude-1': c1, 'claude-2': c2, 'opencode-1': oc, 'dsh-1': dsh } = agents;
  for (const title of ['one', 'two', 'three']) await call('POST', `${codex.link}/tasks`, { title });
  await call('POST', `${c1.link}/tasks/1/claim`);
  await call('POST', `${oc.link}/tasks/2/claim`);
  return { ...r, codex, c1, c2, oc, dsh };
}

const task = async (r, n) => (await call('GET', `${r.codex.link}/tasks`)).json.tasks.find((t) => t.id === n);

test('AC-75: a task created after others lists them as its order and as blocked, and the creation message says so', async () => {
  const r = await ordered();
  const made = await call('POST', `${r.codex.link}/tasks`, { title: 'Review completed work', assignee: 'claude-2', after: [3, 1, 2, 2] });
  assert.equal(made.status, 200);
  const t = await task(r, 4);
  assert.deepEqual(t.after, [1, 2, 3]);
  assert.deepEqual(t.blocked, [1, 2, 3]);
  const note = (await r.state()).messages.find((m) => /created task #4/.test(m.text));
  assert.equal(note.text, 'codex-1 created task #4 "Review completed work" for @claude-2, after #1, #2, #3 (blocked by #1, #2, #3)');
  assert.deepEqual((await task(r, 1)).after, []);
});

test('AC-76, AC-77: a blocked task cannot be claimed or finished, and only unfinished tasks are named', async () => {
  const r = await ordered();
  await call('POST', `${r.codex.link}/tasks`, { title: 'review', assignee: 'claude-2', after: [1, 2, 3] });
  await call('POST', `${r.c1.link}/tasks/1/done`);
  await call('POST', `${r.oc.link}/tasks/2/done`);
  await call('POST', `${r.dsh.link}/tasks/3/claim`);
  const before = (await r.state()).messages.length;

  const claim = await call('POST', `${r.c2.link}/tasks/4/claim`);
  assert.equal(claim.status, 409);
  assert.equal(claim.json.error, 'task_blocked');
  assert.equal(claim.json.message, 'Task #4 is blocked by #3.');
  const finish = await call('POST', `${r.c2.link}/tasks/4/done`);
  assert.equal(finish.status, 409);
  assert.equal(finish.json.error, 'task_blocked');

  const t = await task(r, 4);
  assert.equal(t.owner, null);
  assert.equal(t.status, 'open');
  assert.equal((await r.state()).messages.length, before);
});

test('AC-78: finishing the last task wakes the assignee, and the claim then works', async () => {
  const r = await ordered();
  await call('POST', `${r.codex.link}/tasks`, { title: 'review', assignee: 'claude-2', after: [1, 2, 3] });
  await call('POST', `${r.c1.link}/tasks/1/done`);
  await call('POST', `${r.oc.link}/tasks/2/done`);
  await call('POST', `${r.dsh.link}/tasks/3/claim`);

  await call('GET', `${r.c2.link}/read`);
  const parked = call('GET', `${r.c2.link}/wait?wait=10`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await call('POST', `${r.dsh.link}/tasks/3/done`);
  const woke = await parked;
  assert.equal(woke.status, 200);
  assert.ok(woke.json.messages.some((m) => m.text === 'Task #4 "review" is ready: #1, #2, #3 are done.'));
  assert.deepEqual((await task(r, 4)).blocked, []);
  assert.equal((await call('POST', `${r.c2.link}/tasks/4/claim`)).status, 200);
});

test('AC-79: after tasks that are already done is not blocked', async () => {
  const r = await ordered();
  await call('POST', `${r.c1.link}/tasks/1/done`);
  const made = await call('POST', `${r.codex.link}/tasks`, { title: 'review', assignee: 'claude-2', after: [1] });
  assert.equal(made.status, 200);
  assert.deepEqual((await task(r, 4)).blocked, []);
  assert.equal((await call('POST', `${r.c2.link}/tasks/4/claim`)).status, 200);
});

test('AC-80, AC-81: an unknown, future or itself task number is refused and nothing is created', async () => {
  const r = await ordered();
  await call('POST', `${r.codex.link}/tasks`, { title: 'four' });
  const unknown = await call('POST', `${r.codex.link}/tasks`, { title: 'review', after: [2, 9] });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.json.error, 'invalid_after');
  assert.match(unknown.json.message, /#9/);
  for (const n of [5, 6]) {
    const res = await call('POST', `${r.created.page}/api/tasks`, { title: 'review', after: [n] });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'invalid_after');
  }
  assert.equal((await r.state()).tasks.length, 4);
});

test('an unassigned blocked task logs when it is ready and wakes nobody', async () => {
  const r = await ordered();
  await call('POST', `${r.codex.link}/tasks`, { title: 'review', after: [1] });
  const parked = call('GET', `${r.dsh.link}/wait?wait=1`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await call('POST', `${r.c1.link}/tasks/1/done`);
  const line = (await r.state()).messages.find((m) => /task #4 "review" is ready/.test(m.text));
  assert.equal(line.kind, 'log');
  assert.deepEqual(line.to, []);
  const res = await parked;
  assert.ok(!res.json?.messages?.some((m) => /is ready/.test(m.text)));
});

test('the personal reference shows how to create a task after others', async () => {
  const r = await ordered();
  const reference = await (await fetch(r.codex.link)).text();
  assert.ok(reference.includes('"after":[1,2,3]'));
});
