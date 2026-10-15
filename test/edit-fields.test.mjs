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
  const created = (await call('POST', `http://127.0.0.1:${port}/new`, { name: 'edit' })).json;
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const edit = (n, body) => call('POST', `${created.page}/api/tasks/${n}`, body);
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  return { join, edit, state };
}

async function seeded() {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  for (const title of ['one', 'two', 'three']) await call('POST', `${codex.link}/tasks`, { title });
  const last = async () => (await r.state()).messages.filter((m) => m.task).at(-1);
  const task = async (n) => (await r.state()).tasks.find((t) => t.id === n);
  return { ...r, codex, claude, last, task };
}

test('edit: title changes and the steward line says what it was', async () => {
  const r = await seeded();
  const res = await r.edit(1, { title: 'uno' });
  assert.equal(res.status, 200);
  assert.equal((await r.task(1)).title, 'uno');
  assert.equal((await r.last()).text, 'you edited task #1 "uno" (was "one")');
  assert.equal((await r.edit(1, { title: '  ' })).status, 400);
  assert.equal((await r.task(1)).title, 'uno');
});

test('edit: assignee moves, clears, mentions and wakes the new one, and refuses unknown handles', async () => {
  const r = await seeded();
  assert.equal((await r.edit(2, { assignee: 'claude-1' })).status, 200);
  assert.equal((await r.task(2)).assignee, 'claude-1');
  let note = await r.last();
  assert.equal(note.text, 'you edited task #2 "two" (now for @claude-1)');
  assert.deepEqual(note.mentions, ['claude-1']);
  assert.deepEqual(note.to, ['claude-1']);

  assert.equal((await r.edit(2, { assignee: 'codex-1' })).status, 200);
  note = await r.last();
  assert.deepEqual(note.to.sort(), ['claude-1', 'codex-1']);

  assert.equal((await r.edit(2, { assignee: null })).status, 200);
  assert.equal((await r.task(2)).assignee, null);
  assert.match((await r.last()).text, /\(now unassigned\)/);

  const bad = await r.edit(2, { assignee: 'ghost-9' });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'unknown_assignee');
});

test('edit: after sets order, blocks the task, clears, and refuses unknown tasks, itself and cycles', async () => {
  const r = await seeded();
  assert.equal((await r.edit(3, { after: [2, 1, 1] })).status, 200);
  const t = await r.task(3);
  assert.deepEqual(t.after, [1, 2]);
  assert.deepEqual(t.blocked, [1, 2]);
  assert.match((await r.last()).text, /\(now after #1, #2\)/);

  assert.equal((await r.edit(3, { after: [] })).status, 200);
  assert.deepEqual((await r.task(3)).blocked, []);
  assert.match((await r.last()).text, /no longer after any task/);

  assert.equal((await r.edit(3, { after: [9] })).json.error, 'invalid_after');
  assert.equal((await r.edit(3, { after: 'x' })).json.error, 'invalid_after_list');
  assert.equal((await r.edit(3, { after: [3] })).json.error, 'after_cycle');
  await r.edit(2, { after: [1] });
  await r.edit(3, { after: [2] });
  assert.equal((await r.edit(1, { after: [3] })).json.error, 'after_cycle');
  assert.deepEqual((await r.task(1)).after, []);
});

test('edit: an unchanged value is not an edit, a claimed task keeps its owner as the one told, and done stays refused', async () => {
  const r = await seeded();
  assert.equal((await r.edit(1, { title: 'one' })).json.error, 'empty_edit');
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await r.edit(1, { assignee: 'codex-1' });
  const note = await r.last();
  assert.deepEqual(note.to, ['claude-1']);
  await call('POST', `${r.claude.link}/tasks/1/done`, { note: 'ok' });
  const done = await r.edit(1, { title: 'late' });
  assert.equal(done.status, 409);
  assert.equal(done.json.error, 'task_done');
});

test('edit: an agent who created the task can edit all fields through its own link', async () => {
  const r = await seeded();
  const res = await call('POST', `${r.codex.link}/tasks/1`, { title: 'renamed', assignee: 'claude-1', after: [2] });
  assert.equal(res.status, 200);
  assert.equal(res.json.title, 'renamed');
  assert.equal(res.json.assignee, 'claude-1');
  assert.deepEqual(res.json.after, [2]);
});
