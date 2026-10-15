import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, url, body) {
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: res.status === 204 ? null : await res.json() };
}

async function room(opts = {}) {
  const huddle = createHuddle(opts);
  const port = await huddle.listen(0);
  running.push(huddle);
  const { json: created } = await call('POST', `http://127.0.0.1:${port}/new`, { name: 'waiting' });
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const presenceOf = async (a) => (await state()).agents.find((x) => x.handle === a.handle).presence;
  const blocked = (a, body = { what: 'run pnpm install (needs network)' }) => call('POST', `${a.link}/blocked`, body);
  const done = (n) => call('POST', `${created.page}/api/asks/${n}`, {});
  return { created, join, state, presenceOf, blocked, done };
}

test('AC-40.1: an agent posts that it is waiting on you; you see a card line and it shows Waiting on you', async () => {
  const r = await room();
  const dsh = await r.join('dsh');
  const made = await r.blocked(dsh);
  assert.equal(made.status, 200);
  assert.deepEqual(
    { kind: made.json.kind, status: made.json.status, title: made.json.title, where: made.json.where, options: made.json.options },
    { kind: 'in-terminal', status: 'open', title: 'run pnpm install (needs network)', where: null, options: [] },
  );
  const { messages, asks } = await r.state();
  const line = messages.find((m) => m.ask === made.json.id);
  assert.equal(line.text, `@${dsh.handle} is waiting for your approval in its own terminal: run pnpm install (needs network)`);
  assert.equal(line.toYou, true);
  assert.equal(asks.length, 1);
  assert.equal(await r.presenceOf(dsh), 'waiting');

  const app = await r.join('claude');
  await r.blocked(app, { what: 'edit settings.json', where: 'the Claude desktop app' });
  assert.ok((await r.state()).messages.some((m) => m.text === `@${app.handle} is waiting for your approval in the Claude desktop app: edit settings.json`));
});

test('AC-40.1: a notice needs what, and where stays short', async () => {
  const r = await room();
  const a = await r.join('gemini');
  for (const body of [{}, { what: '' }, { what: 'x'.repeat(301) }, { what: 'x', where: 'y'.repeat(121) }]) {
    const res = await r.blocked(a, body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    assert.equal(res.json.error, 'invalid_text');
  }
  assert.equal((await r.state()).asks.length, 0);
});

test('AC-40.2: Done on the page clears the notice and the agent shows its usual presence again', async () => {
  const r = await room();
  const a = await r.join('gemini');
  const { json: ask } = await r.blocked(a);
  const res = await r.done(ask.id);
  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'done');
  assert.equal(res.json.doneBy, 'you');
  assert.notEqual(await r.presenceOf(a), 'waiting');
  assert.ok((await r.state()).messages.some((m) => m.ask === ask.id && m.text === 'you marked done: run pnpm install (needs network)'));
  assert.equal((await r.done(ask.id)).status, 409, 'a second Done is refused');
});

test('AC-40.3: the agent\'s next call clears the notice, but a background wait does not', async () => {
  const r = await room();
  const a = await r.join('dsh');
  const { json: ask } = await r.blocked(a);
  assert.equal((await call('GET', `${a.link}/wait?wait=1`)).status, 204);
  assert.equal(await r.presenceOf(a), 'waiting', 'a wait loop keeps running while the agent is blocked');
  await call('GET', `${a.link}/read`);
  const settled = (await r.state()).asks.find((x) => x.id === ask.id);
  assert.equal(settled.status, 'done');
  assert.equal(settled.doneBy, a.handle);
  assert.equal(await r.presenceOf(a), 'working');
});

test('AC-40.3: a second notice replaces the first', async () => {
  const r = await room();
  const a = await r.join('opencode');
  await r.blocked(a, { what: 'first' });
  await r.blocked(a, { what: 'second' });
  const { asks } = await r.state();
  assert.deepEqual(asks.map((x) => [x.title, x.status]), [['first', 'done'], ['second', 'open']]);
});

test('AC-40.4: tasks held by an agent waiting on you are not stall-nudged, and it does not auto-leave', async () => {
  const r = await room({ activeMs: 30, asleepMs: 60, stallMs: 300, idleMs: 400, stallBackoffMs: [300, 300] });
  const a = await r.join('dsh');
  await call('POST', `${a.link}/tasks`, { title: 'install deps', assignee: a.handle });
  await call('POST', `${a.link}/tasks/1/claim`);
  await r.blocked(a);
  await sleep(900);
  const { messages, agents, tasks } = await r.state();
  assert.equal(messages.filter((m) => m.from === 'system' && /^Nobody is working/.test(m.text)).length, 0);
  assert.equal(agents[0].presence, 'waiting');
  assert.equal(tasks[0].status, 'claimed');
  assert.equal(tasks[0].owner, a.handle);
});

test('AC-40.4: the freeze watch neither flags nor releases the claims of an agent waiting on you', async () => {
  const r = await room({ activeMs: 30, asleepMs: 60, releaseMs: 200, stallMs: 20000, idleMs: 20000 });
  const a = await r.join('dsh');
  await call('POST', `${a.link}/tasks`, { title: 'install deps', assignee: a.handle });
  await call('POST', `${a.link}/tasks/1/claim`);
  await r.blocked(a);
  await sleep(600);
  const { messages, tasks } = await r.state();
  assert.equal(messages.filter((m) => m.from === 'system' && /is asleep holding|^Released task/.test(m.text)).length, 0);
  assert.deepEqual([tasks[0].status, tasks[0].owner], ['claimed', a.handle]);
});

test('AC-40.4: a task assigned to an agent waiting on you is not offered to others; the unclaimed clock restarts after', async () => {
  const HOLD = 300;
  const r = await room({ activeMs: 20000, asleepMs: 30000, idleMs: 60000, stallMs: HOLD });
  const lead = await r.join('codex');
  const a = await r.join('dsh');
  await r.join('gemini');
  await call('POST', `${lead.link}/tasks`, { title: 'install deps', assignee: a.handle });
  const { json: ask } = await r.blocked(a);
  const offers = async () => (await r.state()).messages.filter((m) => m.from === 'system' && /^Task #1 "install deps" is ready/.test(m.text));
  await sleep(HOLD * 3);
  assert.equal((await offers()).length, 0);
  await r.done(ask.id);
  await sleep(HOLD / 3);
  assert.equal((await offers()).length, 0, 'the stall window starts again after Done');
  await sleep(HOLD * 2);
  assert.equal((await offers()).length, 1);
});

test('AC-40.5: the ask sweep never times out a notice', async () => {
  const r = await room({ askMs: 50 });
  const a = await r.join('gemini');
  await r.blocked(a);
  await sleep(200);
  assert.equal((await r.state()).asks[0].status, 'open');
});

test('AC-40.7: the personal protocol tells terminal agents to post the notice; headless agents never see it', async () => {
  const r = await room();
  const reference = async (harness, role) =>
    (await fetch((await call('POST', `${r.created.join}/join`, { harness, ...(role && { role }) })).json.link)).text();
  const gemini = await reference('gemini');
  assert.match(gemini, /Waiting on you: curl -s -X POST \S+\/blocked -H 'content-type: application\/json' -d '\{"what":/);
  assert.match(gemini, /- Before you run anything your\n {2}own app will ask @you to approve, post "Waiting on you" \(POST blocked\)/);
  assert.match(await reference('codex'), /- With page approvals on, your permission prompts ask @you on the page\. Without them, before you run anything/);
  const headless = await reference('codex', 'headless');
  assert.doesNotMatch(headless, /\/blocked|Waiting on you/);
});

test('AC-40.7: the paste-in invite tells an agent without the skill to post the notice', async () => {
  const r = await room();
  assert.match(r.created.invite, /6\. Before you run anything your own app will ask me to approve, post curl -s -X POST <link>\/blocked/);
});
