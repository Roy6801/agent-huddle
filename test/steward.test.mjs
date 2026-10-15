import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function call(method, url, body) {
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return res.json();
}

async function room(opts = {}, body = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = await call('POST', `http://127.0.0.1:${port}/new`, { name: 'steward', ...body });
  const join = (body) => call('POST', `${created.join}/join`, body);
  const state = () => call('GET', `${created.page}/api/state`);
  const post = async (agent, text) => (await fetch(`${agent.link}/post`, { method: 'POST', body: JSON.stringify({ text }) })).status;
  return { created, join, state, post };
}

const notices = async (state) =>
  (await state()).messages.filter((m) => m.from === 'system' && m.toYou && /round cap of/.test(m.text));

test('AC-49: the agent that joins with the lead key is the lead, once', async () => {
  const { created, join } = await room();
  assert.equal(typeof created.lead, 'string');

  const codex = await join({ harness: 'codex', lead: created.lead });
  assert.equal(codex.lead, 'codex-1');
  assert.equal(codex.role, 'lead');

  const claude = await join({ harness: 'claude', role: 'lead' });
  assert.equal(claude.role, 'lead');
  assert.equal(claude.lead, 'codex-1');

  const opencode = await join({ harness: 'opencode', lead: created.lead });
  assert.equal(opencode.lead, 'codex-1');
  assert.equal(opencode.role, null);

  const leads = (agents) => agents.filter((a) => a.lead).map((a) => a.handle);
  assert.deepEqual(leads((await call('GET', `${codex.link}/who`)).agents), ['codex-1']);
  assert.deepEqual(leads((await call('GET', `${created.page}/api/state`)).agents), ['codex-1']);
  assert.equal((await call('GET', `${claude.link}/me`)).lead, 'codex-1');
});

test('a wrong lead key is ignored and the join still works', async () => {
  const { created, join } = await room();
  const wrong = await join({ harness: 'codex', lead: 'nope' });
  assert.equal(wrong.handle, 'codex-1');
  assert.equal(wrong.lead, null);
  assert.equal(wrong.role, null);
  assert.equal((await join({ harness: 'claude', lead: created.lead })).lead, 'claude-1');
});

test('AC-50: reaching the round cap posts one notice to you, again after you act', async () => {
  const { created, join, state, post } = await room({}, { roundCap: 3 });
  const claude = await join({ harness: 'claude' });
  const dsh = await join({ harness: 'dsh' });
  for (const text of ['one', 'two', 'three']) assert.equal(await post(claude, text), 200);
  assert.equal(await post(dsh, 'four'), 429);
  assert.equal(await post(claude, 'five'), 429);
  const [first] = await notices(state);
  assert.equal((await notices(state)).length, 1);
  assert.match(first.text, /round cap of 3 agent posts is reached: agents are waiting on @you/);

  await call('POST', `${created.page}/api/post`, { text: 'carry on' });
  for (const text of ['one', 'two', 'three']) assert.equal(await post(dsh, text), 200);
  assert.equal((await notices(state)).length, 2);
});

test('AC-51: steward posts never raise the streak; agent replies do', async () => {
  const { join, state, post } = await room({ quietMs: 0 });
  const codex = await join({ harness: 'codex' });
  const claude = await join({ harness: 'claude' });
  await post(claude, 'warming up');
  assert.equal((await state()).agentStreak, 1);
  await join({ harness: 'dsh' });
  assert.equal((await state()).agentStreak, 1);
  await post(claude, `@${codex.handle} task #1 lands in 5 min`);
  const after = await state();
  assert.ok(after.messages.some((m) => m.from === 'system' && m.text.startsWith(codex.handle)), 'a quiet note was posted');
  assert.equal(after.agentStreak, 2);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quietNotes = async (state, handle) =>
  (await state()).messages.filter((m) => m.from === 'system' && m.toYou && m.text.startsWith(handle));

test('AC-52: quiet-agent notes repeat after the interval, not on every mention', async () => {
  const { join, state, post } = await room({ quietMs: 10, nudgeRepeatMs: 300 });
  const codex = await join({ harness: 'codex' });
  const dsh = await join({ harness: 'dsh' });
  await sleep(30);
  await post(dsh, `@${codex.handle} kickoff`);
  await post(dsh, `@${codex.handle} again`);
  assert.equal((await quietNotes(state, codex.handle)).length, 1);
  await sleep(320);
  await post(dsh, `@${codex.handle} still there?`);
  assert.equal((await quietNotes(state, codex.handle)).length, 2);

  for (let i = 0; i < 12; i++) {
    await post(dsh, `@${codex.handle} ping ${i}`);
    await sleep(50);
  }
  const total = (await quietNotes(state, codex.handle)).length;
  assert.ok(total >= 3 && total <= 5, `notes bounded by the interval, got ${total}`);
});

test('AC-53: the quiet note depends on the harness', async () => {
  const { join, state, post } = await room({ quietMs: 10, nudgeRepeatMs: 60000 });
  const agents = {};
  for (const harness of ['codex', 'agy', 'claude', 'opencode', 'dsh']) agents[harness] = await join({ harness });
  const reporter = await join({ harness: 'claude' });
  await post(agents.codex, 'replied just now');
  await sleep(30);
  for (const agent of Object.values(agents)) await post(reporter, `@${agent.handle} README done`);
  for (const harness of ['codex', 'agy']) {
    const [note] = await quietNotes(state, agents[harness].handle);
    assert.match(note.text, /cannot be woken from the room once its turn ends .*nudge it in its own terminal/, harness);
    assert.doesNotMatch(note.text, /when it next waits/, harness);
  }
  for (const harness of ['claude', 'opencode', 'dsh']) {
    const [note] = await quietNotes(state, agents[harness].handle);
    assert.match(note.text, /is working .*it will read this when it next waits/, harness);
  }
});
