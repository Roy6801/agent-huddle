import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const HOLD = 400;
// Agents fall asleep 60 ms after their last call, well inside one hold.
const TIMERS = { activeMs: 30, asleepMs: 60, stallMs: HOLD };

async function call(method, url, body) {
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return res.status === 204 ? null : res.json();
}

async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...TIMERS, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = await call('POST', `http://127.0.0.1:${port}/new`, { name: 'stall' });
  const join = (harness) => call('POST', `${created.join}/join`, { harness });
  const state = () => call('GET', `${created.page}/api/state`);
  const nudges = async () => (await state()).messages.filter((m) => m.from === 'system' && /^(Nobody is working|The room is paused)/.test(m.text));
  const task = (agent, title, assignee) => call('POST', `${agent ? agent.link : `${created.page}/api`}/tasks`, { title, ...(assignee && { assignee }) });
  return { created, join, state, nudges, task };
}

async function stalledRoom(opts) {
  const r = await room(opts);
  const codex = await r.join('codex');
  const opencode = await r.join('opencode');
  const claude = await r.join('claude');
  await r.task(codex, 'Write and run CLI tests', opencode.handle);
  await call('POST', `${opencode.link}/tasks/1/claim`);
  await r.task(codex, 'Review completed work', claude.handle);
  return { ...r, codex, opencode, claude };
}

const clock = (iso) => new Date(iso).toTimeString().slice(0, 5);

test('AC-57: a stalled room nudges you after the hold, with tasks, holders and times', async () => {
  const r = await stalledRoom();
  await sleep(HOLD / 2);
  assert.equal((await r.nudges()).length, 0, 'not before the hold ends');
  await sleep(HOLD * 2);
  const [nudge, ...more] = await r.nudges();
  assert.equal(more.length, 0);
  assert.equal(nudge.toYou, true);
  assert.deepEqual(nudge.to, []);
  const [t1, t2] = (await r.state()).tasks;
  assert.match(nudge.text, new RegExp(`#1 "Write and run CLI tests" held by @opencode-1 since ${clock(t1.since)}`));
  assert.match(nudge.text, new RegExp(`#2 "Review completed work" unclaimed, assigned to @claude-1, since ${clock(t2.since)}`));
});

test('AC-57: no hold without pending tasks or while an agent is Working', async () => {
  const empty = await room();
  await empty.join('codex');
  await sleep(HOLD * 3);
  assert.equal((await empty.nudges()).length, 0);

  const busy = await stalledRoom({ activeMs: HOLD * 10, asleepMs: HOLD * 20 });
  await sleep(HOLD * 3);
  assert.equal((await busy.nudges()).length, 0);
});

test('AC-58: a Listening holder is nudged before you, through its wait', async () => {
  const r = await stalledRoom();
  await call('GET', `${r.opencode.link}/read`);
  const woken = await call('GET', `${r.opencode.link}/wait?wait=5`);
  const nudge = woken.messages.find((m) => /^Nobody is working/.test(m.text));
  assert.ok(nudge, 'the wait returns the nudge');
  assert.match(nudge.text, /#1 "Write and run CLI tests" held by @opencode-1/);
  assert.doesNotMatch(nudge.text, /#2/);
  assert.deepEqual(nudge.to, ['opencode-1']);
  assert.equal(nudge.toYou, false);
});

test('AC-59: activity during the hold cancels it and a new full hold starts', async () => {
  for (const act of [
    (r) => call('POST', `${r.claude.link}/post`, { text: '@opencode-1 are the tests green?' }),
    (r) => r.task(null, 'Tidy the README'),
  ]) {
    const r = await stalledRoom();
    await sleep(HOLD * 0.75);
    await act(r);
    await sleep(HOLD * 0.5);
    assert.equal((await r.nudges()).length, 0, 'the first hold was cancelled');
    await sleep(HOLD * 2);
    assert.equal((await r.nudges()).length, 1, 'a new full hold ended in one nudge');
  }
});

test('AC-60: nudges back off, go quiet, and start over after a change', async () => {
  const r = await stalledRoom({ stallBackoffMs: [HOLD * 2, HOLD * 3] });
  await sleep(HOLD * 9);
  assert.equal((await r.nudges()).length, 3, 'the first nudge and two backoffs, then quiet');

  await call('POST', `${r.opencode.link}/tasks/1/done`, { note: 'tests green' });
  await sleep(HOLD / 2);
  assert.equal((await r.nudges()).length, 3, 'a new hold, not an instant nudge');
  await sleep(HOLD * 2);
  const after = await r.nudges();
  assert.equal(after.length, 4);
  assert.doesNotMatch(after.at(-1).text, /#1 /);
  assert.match(after.at(-1).text, /#2 "Review completed work"/);
});

// Waits until the deadline, like an agent's wait loop; waits are not activity.
async function waitLoop(agent, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) await call('GET', `${agent.link}/wait?wait=1`);
}

test('AC-60: a Listening holder woken by nudges still gets the backoff, and the last nudge goes to you', async () => {
  const r = await room({ stallBackoffMs: [HOLD * 2, HOLD * 3] });
  const codex = await r.join('codex');
  const opencode = await r.join('opencode');
  await r.task(codex, 'Write and run CLI tests', opencode.handle);
  await call('POST', `${opencode.link}/tasks/1/claim`);
  await waitLoop(opencode, HOLD * 9);
  const sent = await r.nudges();
  assert.equal(sent.length, 3);
  assert.deepEqual(sent.map((m) => m.toYou), [false, false, true]);
  assert.deepEqual(sent[0].to, ['opencode-1']);
  assert.match(sent[2].text, /#1 "Write and run CLI tests" held by @opencode-1/);
});

test('while the room is paused at the round cap, only you are nudged', async () => {
  const r = await stalledRoom();
  await call('POST', `${r.created.page}/api/settings`, { roundCap: 1 });
  await call('POST', `${r.claude.link}/post`, { text: 'one post reaches the cap' });
  await waitLoop(r.opencode, HOLD * 2.5);
  const [nudge, ...more] = await r.nudges();
  assert.equal(more.length, 0);
  assert.equal(nudge.toYou, true);
  assert.deepEqual(nudge.to, []);
  assert.match(nudge.text, /^The room is paused at the round cap and tasks are pending: #1 .*; #2 .*Post to let agents continue\.$/);
});
