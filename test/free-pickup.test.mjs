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
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// codex-1 leads; #1 "parser" is for claude-1, #2 "docs" for gemini-1, #3 "lint" is unassigned. Everyone has read.
async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = (await call('POST', `http://127.0.0.1:${port}/new`, { name: 'pickup' })).json;
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const codex = await join('codex');
  const claude = await join('claude');
  const gemini = await join('gemini');
  const opencode = await join('opencode');
  await call('POST', `${codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await call('POST', `${codex.link}/tasks`, { title: 'docs', assignee: 'gemini-1' });
  await call('POST', `${codex.link}/tasks`, { title: 'lint' });
  const agents = [codex, claude, gemini, opencode];
  const readAll = async () => {
    for (const a of agents) await call('GET', `${a.link}/read?limit=500`);
  };
  await readAll();
  const settings = (body) => call('POST', `${created.page}/api/settings`, body);
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const task = async (n) => (await state()).tasks.find((t) => t.id === n);
  const lines = async () => (await state()).messages.filter((m) => m.task);
  return { created, codex, claude, gemini, opencode, readAll, settings, state, task, lines };
}

test('regular: a free agent claims a task assigned to someone else, it moves to the claimer and the old assignee is told', async () => {
  const r = await room();
  const parked = call('GET', `${r.claude.link}/wait?wait=25`);
  await sleep(100);

  const res = await call('POST', `${r.opencode.link}/tasks/1/claim`);
  assert.equal(res.status, 200, res.text);
  const t = await r.task(1);
  assert.equal(t.status, 'claimed');
  assert.equal(t.owner, 'opencode-1');
  assert.equal(t.assignee, 'opencode-1');

  const line = (await r.lines()).at(-1);
  assert.equal(line.text, 'opencode-1 took task #1 "parser" from @claude-1');
  assert.deepEqual(line.mentions, ['claude-1']);
  assert.deepEqual(line.to, ['claude-1']);
  const woken = await parked;
  assert.equal(woken.status, 200);
  assert.ok(woken.json.messages.some((m) => m.text === line.text));
});

test('regular: finishing an unclaimed task assigned to someone else takes it too', async () => {
  const r = await room();
  const res = await call('POST', `${r.opencode.link}/tasks/2/done`, { note: 'docs/README.md' });
  assert.equal(res.status, 200, res.text);
  const t = await r.task(2);
  assert.equal(t.status, 'done');
  assert.equal(t.owner, 'opencode-1');
  assert.equal(t.assignee, 'opencode-1');
  const took = (await r.lines()).find((m) => m.text === 'opencode-1 took task #2 "docs" from @gemini-1');
  assert.deepEqual(took.to, ['gemini-1']);
});

test('regular: a busy agent cannot take someone else\'s task, but may still claim its own and unassigned ones', async () => {
  const r = await room();
  assert.equal((await call('POST', `${r.claude.link}/tasks/1/claim`)).status, 200);
  const before = (await r.state()).messages.length;

  const refused = await call('POST', `${r.claude.link}/tasks/2/claim`);
  assert.equal(refused.status, 409);
  assert.equal(refused.json.error, 'not_free');
  assert.equal(refused.json.message, 'You hold #1, and task #2 is assigned to @gemini-1.');
  assert.match(refused.json.instruction, /finish .* or release .* #1 first/);
  const done = await call('POST', `${r.claude.link}/tasks/2/done`);
  assert.equal(done.json.error, 'not_free');
  const t = await r.task(2);
  assert.equal(t.status, 'open');
  assert.equal(t.assignee, 'gemini-1');
  assert.equal((await r.state()).messages.length, before);

  assert.equal((await call('POST', `${r.claude.link}/tasks/3/claim`)).status, 200);
  assert.equal((await r.task(3)).owner, 'claude-1');
});

test('strict: only the assignee may claim or finish an assigned task; unassigned and gone assignees stay open to anyone', async () => {
  const r = await room();
  const set = await r.settings({ assignment: 'strict' });
  assert.equal(set.status, 200);
  assert.equal(set.json.assignment, 'strict');
  const s = await r.state();
  assert.equal(s.assignment, 'strict');
  assert.match(s.messages.at(-1).text, /^you set strict assignment: only its assignee may claim or finish an assigned task/);
  assert.equal((await call('GET', `${r.opencode.link}/me`)).json.assignment, 'strict');
  assert.match((await call('GET', r.opencode.link)).text, /This room\n {2}uses strict assignment/);

  for (const action of ['claim', 'done']) {
    const res = await call('POST', `${r.opencode.link}/tasks/1/${action}`);
    assert.equal(res.status, 403);
    assert.equal(res.json.error, 'not_assignee');
    assert.match(res.json.instruction, /Only @claude-1 may claim or finish it/);
  }
  assert.equal((await r.task(1)).status, 'open');
  assert.equal((await call('POST', `${r.claude.link}/tasks/1/claim`)).status, 200);
  assert.equal((await call('POST', `${r.opencode.link}/tasks/3/claim`)).status, 200);

  await call('POST', `${r.gemini.link}/leave`);
  assert.equal((await call('POST', `${r.codex.link}/tasks/2/claim`)).status, 200);
  assert.equal((await r.task(2)).assignee, 'codex-1');
});

test('a new unassigned task wakes free agents only: not busy, asleep or the creator; an assigned one wakes only its assignee', async () => {
  const r = await room({ quietMs: 60000 });
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await r.readAll();
  await call('GET', `${r.gemini.link}/me?rest=1`);

  await call('POST', `${r.codex.link}/tasks`, { title: 'changelog' });
  let line = (await r.lines()).at(-1);
  assert.equal(line.text, 'codex-1 created task #4 "changelog"; it is ready and unassigned: claim it if you can take it');
  assert.deepEqual(line.to, ['opencode-1']);
  assert.deepEqual(line.mentions, ['opencode-1']);

  await call('POST', `${r.codex.link}/tasks`, { title: 'release', assignee: 'claude-1' });
  line = (await r.lines()).at(-1);
  assert.equal(line.text, 'codex-1 created task #5 "release" for @claude-1');
  assert.deepEqual(line.to, ['claude-1']);

  await call('POST', `${r.codex.link}/tasks`, { title: 'later', after: [5] });
  assert.deepEqual((await r.lines()).at(-1).to, []);
});

test('a released, reopened or abandoned task with nobody on it is offered to the free agents', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('POST', `${r.gemini.link}/tasks/2/claim`);
  await r.readAll();

  await call('POST', `${r.claude.link}/tasks/1/release`);
  let offer = (await r.lines()).at(-1);
  assert.equal(offer.text, 'Task #1 "parser" is ready and @claude-1 released it: claim it if you can take it.');
  assert.deepEqual(offer.to.sort(), ['codex-1', 'opencode-1']);

  await call('POST', `${r.gemini.link}/leave`);
  offer = (await r.lines()).at(-1);
  assert.equal(offer.text, 'Task #2 "docs" is ready and its assignee @gemini-1 left: claim it if you can take it.');
  assert.deepEqual(offer.to.sort(), ['claude-1', 'codex-1', 'opencode-1']);

  await call('POST', `${r.created.page}/api/tasks/3/cancel`, {});
  await call('POST', `${r.created.page}/api/tasks/3/reopen`, { reason: 'still needed' });
  offer = (await r.lines()).at(-1);
  assert.equal(offer.text, 'Task #3 "lint" is ready and unassigned: claim it if you can take it.');
});

test('strict: a task released by its own assignee stays with it and is not offered', async () => {
  const r = await room();
  await r.settings({ assignment: 'strict' });
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('POST', `${r.claude.link}/tasks/1/release`);
  const last = (await r.state()).messages.at(-1);
  assert.equal(last.text, 'claude-1 released task #1');
  assert.equal((await r.task(1)).assignee, 'claude-1');
});

test('settings: assignment must be regular or strict, and an unchanged mode posts nothing', async () => {
  const r = await room();
  assert.equal((await r.state()).assignment, 'regular');
  const before = (await r.state()).messages.length;
  for (const value of ['loose', true, null, 'STRICT']) {
    const res = await r.settings({ assignment: value });
    assert.equal(res.status, 400, JSON.stringify(value));
    assert.equal(res.json.error, 'invalid_assignment');
  }
  assert.equal((await r.settings({ assignment: 'regular' })).status, 200);
  assert.equal((await r.state()).messages.length, before);
  assert.match((await r.settings({})).json.instruction, /assignment/);
  assert.equal((await call('POST', `${r.codex.link}/api/settings`, { assignment: 'strict' })).status, 404);
  assert.equal((await r.state()).assignment, 'regular');
});
