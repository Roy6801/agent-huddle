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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// codex-1 is the lead and created #1 "parser" (for claude-1), #2 "docs" and #3 "release" (after #1).
async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const created = (await call('POST', `${base}/new`, { name: 'board' })).json;
  const join = async (harness, extra = {}) => (await call('POST', `${created.join}/join`, { harness, ...extra })).json;
  const codex = await join('codex', { lead: created.lead });
  const claude = await join('claude');
  const gemini = await join('gemini');
  await call('POST', `${codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await call('POST', `${codex.link}/tasks`, { title: 'docs' });
  await call('POST', `${codex.link}/tasks`, { title: 'release', after: [1] });
  const act = (n, action, body) => call('POST', `${created.page}/api/tasks/${n}/${action}`, body);
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const task = async (n) => (await state()).tasks.find((t) => t.id === n);
  const last = async () => (await state()).messages.filter((m) => m.task).at(-1);
  for (const a of [codex, claude, gemini]) await call('GET', `${a.link}/read?limit=500`);
  return { base, created, join, codex, claude, gemini, act, state, task, last };
}

test('board done: you finish a claimed task with a note, the holder and creator are woken, dependents are ready', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  const parked = call('GET', `${r.claude.link}/wait?wait=25`);
  await sleep(100);

  const res = await r.act(1, 'done', { note: 'merged by hand' });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const t = await r.task(1);
  assert.equal(t.status, 'done');
  assert.equal(t.owner, 'you');
  assert.equal(t.note, 'merged by hand');

  const msgs = (await r.state()).messages;
  const line = msgs.find((m) => m.text === 'you marked task #1 "parser" done (held by @claude-1): merged by hand');
  assert.ok(line);
  assert.deepEqual(line.mentions.sort(), ['claude-1', 'codex-1']);
  assert.deepEqual(line.to.sort(), ['claude-1', 'codex-1']);
  const ready = msgs.find((m) => /^Task #3 "release" is ready and unassigned/.test(m.text));
  assert.deepEqual(ready.to.sort(), ['claude-1', 'codex-1', 'gemini-1']);
  assert.equal((await r.task(3)).blocked.length, 0);

  const woken = await parked;
  assert.equal(woken.status, 200);
  const got = woken.json.messages.find((m) => m.text === line.text);
  assert.equal(got.taskDetail.status, 'done');
});

test('board done: the note is optional and an unclaimed task tells its assignee', async () => {
  const r = await room();
  assert.equal((await r.act(1, 'done')).status, 200);
  const line = (await r.state()).messages.find((m) => /^you marked/.test(m.text));
  assert.equal(line.text, 'you marked task #1 "parser" done');
  assert.deepEqual(line.to.sort(), ['claude-1', 'codex-1']);
  assert.equal((await r.task(1)).note, null);
});

test('board done: a blocked or done task is refused and nothing changes', async () => {
  const r = await room();
  const before = (await r.state()).messages.length;
  const blocked = await r.act(3, 'done', { note: 'skip it' });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.error, 'task_blocked');
  assert.equal((await r.task(3)).status, 'open');
  assert.equal((await r.state()).messages.length, before);

  await r.act(2, 'done');
  const again = await r.act(2, 'done');
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'task_done');
  assert.equal((await r.act(2, 'done', { note: '  ' })).status, 409);
  assert.equal((await r.act(9, 'done')).json.error, 'unknown_task');
});

test('board done: finishing the last task sends the summary with the task done by you', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/done`, { note: 'parser.mjs' });
  await call('POST', `${r.gemini.link}/tasks/2/claim`);
  await r.act(2, 'done');
  await r.act(3, 'done', { note: 'tagged v1 by hand' });
  const summary = (await r.state()).messages.find((m) => /^All 3 tasks are done:/.test(m.text));
  assert.equal(
    summary.text,
    ['All 3 tasks are done:', '#1 "parser" by claude-1: parser.mjs', '#2 "docs" by you: no note', '#3 "release" by you: tagged v1 by hand'].join('\n'),
  );
  assert.deepEqual(summary.to, ['codex-1']);
});

test('board release: the holder is told and woken, the task is open again for its assignee', async () => {
  const r = await room();
  await call('POST', `${r.gemini.link}/tasks/1/claim`);
  await call('POST', `${r.codex.link}/tasks/1`, { assignee: 'claude-1' });
  await call('GET', `${r.gemini.link}/read`);
  const parked = call('GET', `${r.gemini.link}/wait?wait=25`);
  await sleep(100);

  const res = await r.act(1, 'release');
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const t = await r.task(1);
  assert.equal(t.status, 'open');
  assert.equal(t.owner, null);
  assert.equal(t.assignee, 'claude-1');
  const line = await r.last();
  assert.equal(line.text, 'you released task #1 "parser" from @gemini-1; it is open again for @claude-1');
  assert.deepEqual(line.to.sort(), ['claude-1', 'gemini-1']);
  assert.ok((await parked).json.messages.some((m) => m.text === line.text));

  const open = await r.act(1, 'release');
  assert.equal(open.status, 409);
  assert.equal(open.json.error, 'not_claimed');
  assert.match(open.json.message, /open/);
  await r.act(2, 'done');
  assert.equal((await r.act(2, 'release')).json.error, 'not_claimed');
});

test('board release: an asleep holder is still woken and you get the quiet note', async () => {
  const r = await room({ quietMs: 50, nudgeRepeatMs: 0 });
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('GET', `${r.claude.link}/me?rest=1`);
  await sleep(100);
  assert.equal((await r.state()).agents.find((a) => a.handle === 'claude-1').presence, 'asleep');

  await r.act(1, 'release');
  const msgs = (await r.state()).messages;
  const line = msgs.find((m) => /^you released task #1/.test(m.text));
  assert.deepEqual(line.to, ['claude-1']);
  const note = msgs.find((m) => m.id > line.id && m.toYou);
  assert.match(note.text, /claude-1/);
});

test('board reassign: a claimed task moves to a new agent, the old holder is released and told, the new one woken with the task', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  const parked = call('GET', `${r.gemini.link}/wait?wait=25`);
  await sleep(100);

  const res = await r.act(1, 'assign', { assignee: '@gemini-1' });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const t = await r.task(1);
  assert.equal(t.status, 'open');
  assert.equal(t.owner, null);
  assert.equal(t.assignee, 'gemini-1');
  const line = await r.last();
  assert.equal(line.text, 'you reassigned task #1 "parser" to @gemini-1 (released from @claude-1)');
  assert.deepEqual(line.mentions.sort(), ['claude-1', 'gemini-1']);
  assert.deepEqual(line.to.sort(), ['claude-1', 'gemini-1']);

  const woken = (await parked).json.messages.find((m) => m.text === line.text);
  assert.equal(woken.taskDetail.assignee, 'gemini-1');
  assert.equal(woken.taskDetail.title, 'parser');

  assert.equal((await call('POST', `${r.gemini.link}/tasks/1/claim`)).status, 200);
});

test('board reassign: an open task of an agent who left goes to another, and the one who left is not mentioned', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('POST', `${r.claude.link}/leave`);
  assert.equal((await r.task(1)).status, 'open');

  assert.equal((await r.act(1, 'assign', { assignee: 'gemini-1' })).status, 200);
  const line = await r.last();
  assert.equal(line.text, 'you reassigned task #1 "parser" to @gemini-1');
  assert.deepEqual(line.to, ['gemini-1']);

  assert.equal((await r.act(1, 'assign', { assignee: null })).status, 200);
  assert.equal((await r.task(1)).assignee, null);
  const [unassigned, offer] = (await r.state()).messages.filter((m) => m.task).slice(-2);
  assert.equal(unassigned.text, 'you unassigned task #1 "parser"');
  assert.deepEqual(offer.to, ['codex-1']);
});

test('board reassign: unchanged, unknown and done are refused', async () => {
  const r = await room();
  const same = await r.act(1, 'assign', { assignee: 'claude-1' });
  assert.equal(same.status, 409);
  assert.equal(same.json.error, 'same_assignee');
  assert.equal((await r.act(2, 'assign', {})).json.error, 'same_assignee');
  const unknown = await r.act(1, 'assign', { assignee: 'ghost-1' });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.json.error, 'unknown_assignee');
  await r.act(2, 'done');
  assert.equal((await r.act(2, 'assign', { assignee: 'gemini-1' })).json.error, 'task_done');

  await call('POST', `${r.gemini.link}/tasks/1/claim`);
  assert.equal((await r.act(1, 'assign', { assignee: 'claude-1' })).status, 200);
  assert.equal((await r.task(1)).owner, null);
});

test('board actions are page-only and refused once the room ended', async () => {
  const r = await room();
  assert.equal((await call('POST', `${r.claude.link}/tasks/1/assign`, { assignee: 'gemini-1' })).status, 404);
  await call('POST', `${r.base}/admin/rooms/${r.created.id}/end`, undefined, { authorization: 'Bearer admin' });
  const ended = await r.act(2, 'done');
  assert.equal(ended.status, 410);
});
