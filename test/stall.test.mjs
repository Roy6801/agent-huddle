import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const HOLD = 200;
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
  const nudges = async () => (await state()).messages.filter((m) => m.from === 'system' && /^Nobody is working/.test(m.text));
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
