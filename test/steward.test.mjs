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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quietNotes = async (state, handle) =>
  (await state()).messages.filter((m) => m.from === 'system' && m.toYou && m.text.startsWith(handle));

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
  assert.equal((await quietNotes(state, codex.handle)).length, 1);
  assert.equal(after.agentStreak, 2);
});

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
  await post(dsh, `@${codex.handle} and again`);
  assert.equal((await quietNotes(state, codex.handle)).length, 2);
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

async function asleepLeadRoom() {
  const r = await room({ activeMs: 20, asleepMs: 60 });
  const codex = await r.join({ harness: 'codex', lead: r.created.lead });
  const dsh = await r.join({ harness: 'dsh' });
  const claude = await r.join({ harness: 'claude' });
  const task = async (agent, title) =>
    (await fetch(`${agent.link}/tasks`, { method: 'POST', body: JSON.stringify({ title }) }).then((res) => res.json())).id;
  const done = (agent, n, note) => fetch(`${agent.link}/tasks/${n}/done`, { method: 'POST', body: JSON.stringify({ note }) });
  const finished = async (n) => (await r.state()).messages.find((m) => m.text.startsWith(`Task #${n} `) && m.text.includes(' is done by '));
  return { ...r, codex, dsh, claude, task, done, finished };
}

test('AC-54: done notes for an asleep creator are marked for you and still mention it', async () => {
  const r = await asleepLeadRoom();
  const cli = await r.task(r.codex, 'Implement wordfreq CLI');
  const readme = await r.task(r.dsh, 'Write README');
  await sleep(90);
  await r.done(r.claude, cli, 'CLI done, 30 tests pass');
  await r.done(r.claude, readme, 'README written');
  for (const n of [cli, readme]) {
    const line = await r.finished(n);
    assert.equal(line.toYou, true);
    assert.equal(line.mentions.length, 1);
  }
  const state = await r.state();
  assert.ok(!state.messages.some((m) => m.from === 'system' && /^(codex|dsh)-1 (cannot be woken|is asleep)|^Not listening/.test(m.text)), 'no quiet note on top');
});

test('AC-54: a listening lead is woken by the done note, which is not for you', async () => {
  const r = await asleepLeadRoom();
  const n = await r.task(r.codex, 'Implement wordfreq CLI');
  await sleep(30);
  const waiting = fetch(`${r.codex.link}/wait?wait=5`).then((res) => res.json());
  await sleep(20);
  await r.done(r.claude, n, 'CLI done');
  const woken = await waiting;
  assert.ok(woken.messages.some((m) => m.text.startsWith(`Task #${n} `) && m.text.includes(' is done by ')));
  assert.equal((await r.finished(n)).toYou, false);
});

test('AC-55: a report to an asleep lead is also marked for you', async () => {
  const r = await asleepLeadRoom();
  await sleep(90);
  assert.equal(await r.post(r.dsh, '@codex-1 README done, examples and exit codes verified'), 200);
  assert.equal(await r.post(r.dsh, '@claude-1 thanks'), 200);
  const messages = (await r.state()).messages.filter((m) => m.from === 'dsh-1');
  assert.deepEqual(messages.map((m) => m.toYou), [true, false]);
  assert.equal((await quietNotes(r.state, 'codex-1')).length, 0, 'the report itself reaches you; no note about the lead on top');
});

test('AC-63: narrator lines are quiet log lines; the done note is a separate steward message', async () => {
  const r = await room({ activeMs: 20, asleepMs: 60, quietMs: 10 });
  const codex = await r.join({ harness: 'codex', lead: r.created.lead });
  const claude = await r.join({ harness: 'claude' });
  const claude2 = await r.join({ harness: 'claude' });
  await fetch(`${codex.link}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'Implement wordfreq CLI' }) });
  await fetch(`${codex.link}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'Write the README' }) });
  await fetch(`${claude2.link}/read`);
  await sleep(90);
  const parked = fetch(`${claude2.link}/wait?wait=1`).then((res) => res.status);
  await r.join({ harness: 'dsh' });
  await fetch(`${claude.link}/tasks/1/claim`, { method: 'POST' });
  await fetch(`${claude.link}/tasks/1/done`, { method: 'POST', body: JSON.stringify({ note: 'CLI done, 30 tests pass' }) });
  assert.equal(await parked, 204, 'no narrator line woke the parked wait');

  const messages = (await r.state()).messages;
  const logs = messages.filter((m) => m.kind === 'log').map((m) => m.text);
  assert.ok(logs.includes('dsh-1 joined'));
  assert.ok(logs.includes('claude-1 claimed task #1'));
  assert.ok(logs.includes('claude-1 finished task #1 "Implement wordfreq CLI"'));
  for (const m of messages.filter((m) => m.kind === 'log')) assert.deepEqual(m.to, []);
  const note = messages.find((m) => m.text === 'Task #1 "Implement wordfreq CLI" is done by claude-1: CLI done, 30 tests pass');
  assert.equal(note.kind, 'system');
  assert.equal(note.toYou, true, 'codex-1 is asleep, so the done note is for you');
  assert.equal((await quietNotes(r.state, 'codex-1')).length, 0);
});
