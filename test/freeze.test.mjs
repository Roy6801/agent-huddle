import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RELEASE = 400;
// Agents are Asleep 60 ms after their last call and lose their claims after 400 ms of silence; they leave much later.
const TIMERS = { activeMs: 30, asleepMs: 60, releaseMs: RELEASE, idleMs: 20000, stallMs: 20000 };

async function call(method, url, body) {
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

// codex-1 leads and creates #1 "parser" for claude-1, who claims it; gemini-1 is free.
async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...TIMERS, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = (await call('POST', `http://127.0.0.1:${port}/new`, { name: 'freeze' })).json;
  const join = async (harness, extra) => (await call('POST', `${created.join}/join`, { harness, ...extra })).json;
  const codex = await join('codex', { lead: created.lead });
  const claude = await join('claude');
  const gemini = await join('gemini');
  const settings = (body) => call('POST', `${created.page}/api/settings`, body);
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const task = async (n) => (await state()).tasks.find((t) => t.id === n);
  const system = async (re) => (await state()).messages.filter((m) => m.from === 'system' && re.test(m.text));
  return { created, codex, claude, gemini, settings, state, task, system };
}

async function claimed(opts) {
  const r = await room(opts);
  await call('POST', `${r.codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await call('POST', `${r.claude.link}/post`, { text: 'starting on the parser, running the migration first' });
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  return r;
}

// Keeps an agent Listening: waits until the deadline, like its wait loop.
async function waitLoop(agent, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) await call('GET', `${agent.link}/wait?wait=1`);
}

test('an agent asleep holding a claim is flagged to you once, with its last post and the approvals hint', async () => {
  const r = await claimed();
  await sleep(RELEASE / 2);
  const who = (await r.state()).agents.find((a) => a.handle === 'claude-1');
  assert.equal(who.presence, 'asleep');
  assert.deepEqual(who.asleepHolding, [1]);
  assert.equal((await r.state()).agents.find((a) => a.handle === 'gemini-1').asleepHolding, undefined);
  const [note, ...more] = await r.system(/is asleep holding/);
  assert.equal(more.length, 0);
  assert.equal(note.toYou, true);
  assert.match(note.text, /^@claude-1 is asleep holding #1 "parser" \(silent since \d\d:\d\d; last posted at \d\d:\d\d: "starting on the parser, running the migration first"\)/);
  assert.match(note.text, /approvals on/);
  assert.equal((await r.task(1)).status, 'claimed', 'flagged, not yet released');
});

test('a claim is released after the release time asleep: open again for its assignee, you, the lead and the owner told, free agents offered it', async () => {
  const r = await claimed();
  await waitLoop(r.gemini, RELEASE * 1.5);
  const t = await r.task(1);
  assert.equal(t.status, 'open');
  assert.equal(t.owner, null);
  assert.equal(t.assignee, 'claude-1');
  const [line, ...more] = await r.system(/^Released task #1/);
  assert.equal(more.length, 0);
  assert.match(line.text, /^Released task #1 "parser" from @claude-1, asleep and silent for 0 min: it is open again for @claude-1\.$/);
  assert.equal(line.toYou, true);
  assert.deepEqual(line.to.sort(), ['claude-1', 'codex-1']);
  const [offer] = await r.system(/^Task #1 "parser" is ready/);
  assert.match(offer.text, /is ready and @claude-1 fell asleep holding it: claim it if you can take it\./);
  assert.deepEqual(offer.to, ['gemini-1'], 'free and awake agents only');
  assert.equal((await r.state()).agents.find((a) => a.handle === 'claude-1').asleepHolding, undefined);
});

test('no release before the release time, nor for a Listening or Working holder', async () => {
  const early = await claimed();
  await sleep(RELEASE * 0.6);
  assert.equal((await early.task(1)).status, 'claimed');

  const listening = await claimed();
  await waitLoop(listening.claude, RELEASE * 2);
  assert.equal((await listening.task(1)).status, 'claimed');
  assert.equal((await listening.system(/is asleep holding|^Released task/)).length, 0);

  const working = await claimed({ activeMs: RELEASE * 10, asleepMs: RELEASE * 20, idleMs: RELEASE * 40 });
  await sleep(RELEASE * 2);
  assert.equal((await working.task(1)).status, 'claimed');
  assert.equal((await working.system(/is asleep holding|^Released task/)).length, 0);
});

test('a holder that leaves releases at once, and you and the lead are told', async () => {
  const r = await claimed();
  await call('POST', `${r.claude.link}/leave`);
  assert.equal((await r.task(1)).status, 'open');
  const [line] = await r.system(/^claude-1 left; released task #1$/);
  assert.equal(line.kind, 'system');
  assert.equal(line.toYou, true);
  assert.deepEqual(line.to, ['codex-1']);
});

test('strict: an assigned task released from its asleep assignee stays with it and is not offered; an unassigned one is', async () => {
  const r = await room();
  await r.settings({ assignment: 'strict' });
  await call('POST', `${r.codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await call('POST', `${r.codex.link}/tasks`, { title: 'lint' });
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('POST', `${r.claude.link}/tasks/2/claim`);
  await waitLoop(r.gemini, RELEASE * 1.5);
  const [one, two] = (await r.state()).tasks;
  assert.deepEqual([one.status, one.assignee, two.status, two.assignee], ['open', 'claude-1', 'open', null]);
  const lines = (await r.system(/^Released task/)).map((m) => m.text);
  assert.ok(lines.includes('Released task #1 "parser" from @claude-1, asleep and silent for 0 min: it stays with @claude-1 (strict assignment); reassign it from the board to hand it on.'));
  assert.ok(lines.includes('Released task #2 "lint" from @claude-1, asleep and silent for 0 min: it is open again.'));
  assert.equal((await r.system(/^Task #1 "parser" is ready/)).length, 0);
  assert.equal((await r.system(/^Task #2 "lint" is ready and @claude-1 fell asleep holding it/)).length, 1);
});

test('an assigned task left unclaimed for the stall window is offered to free agents once, in regular rooms only', async () => {
  const HOLD = 300;
  const opts = { activeMs: 20000, asleepMs: 30000, idleMs: 60000, stallMs: HOLD };
  const r = await room(opts);
  await call('POST', `${r.codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await sleep(HOLD / 3);
  assert.equal((await r.system(/^Task #1 "parser" is ready/)).length, 0, 'not before the stall window');
  await sleep(HOLD * 3);
  const [offer, ...more] = await r.system(/^Task #1 "parser" is ready/);
  assert.equal(more.length, 0, 'offered once');
  assert.match(offer.text, /is ready and @claude-1 has not claimed it in 0 min: claim it if you can take it\./);
  assert.deepEqual(offer.to.sort(), ['codex-1', 'gemini-1']);
  const took = await call('POST', `${r.gemini.link}/tasks/1/claim`);
  assert.equal(took.status, 200);
  assert.equal((await r.task(1)).assignee, 'gemini-1');

  const strict = await room(opts);
  await strict.settings({ assignment: 'strict' });
  await call('POST', `${strict.codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await sleep(HOLD * 3);
  assert.equal((await strict.system(/^Task #1 "parser" is ready/)).length, 0);
});

test('the release timer is set in room settings and shows in state and the settings line', async () => {
  const r = await room();
  const res = await r.settings({ releaseMinutes: 30 });
  assert.equal(res.status, 200);
  const state = await r.state();
  assert.equal(state.presenceTimers.releaseMinutes, 30);
  assert.match(state.messages.at(-1).text, /release claims after 30 min silent$/);
  assert.equal((await call('GET', `${r.claude.link}/me`)).json.presenceTimers.releaseMinutes, 30);
  const protocol = await (await fetch(r.claude.link)).text();
  assert.match(protocol, /released after\s+30 min of silence while Asleep/);
});
