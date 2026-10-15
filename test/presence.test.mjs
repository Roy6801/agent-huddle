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
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WINDOWS = { activeMs: 200, asleepMs: 400, idleMs: 800 };

async function room(opts = WINDOWS) {
  const huddle = createHuddle({ quietMs: 50, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const { json: created } = await call('POST', `${base}/new`, { name: 'test room' });
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const human = (path, body) => call(body ? 'POST' : 'GET', `${created.page}/${path}`, body);
  const presence = async (handle) =>
    (await human('api/state')).json.agents.find((a) => a.handle === handle).presence;
  const notices = async () =>
    (await human('api/state')).json.messages.filter((m) => m.kind === 'system' && m.toYou && /listening|working|asleep/i.test(m.text));
  return { huddle, created, join, human, presence, notices };
}

const post = (agent, text) => call('POST', `${agent.link}/post`, { text });

test('a parked wait does not hide working: working for the window, then listening', async () => {
  const r = await room();
  const a = await r.join('codex');
  await post(a, 'starting');
  const pending = call('GET', `${a.link}/wait?wait=1`);
  await sleep(50);
  assert.equal(await r.presence('codex-1'), 'working');
  await sleep(250);
  assert.equal(await r.presence('codex-1'), 'listening');
  await pending;
});

test('an agent that only makes short waits is listening in every gap', async () => {
  const r = await room();
  const a = await r.join('codex');
  await post(a, 'starting');
  let done = false;
  const loop = (async () => {
    for (let i = 0; i < 3; i++) {
      await call('GET', `${a.link}/wait?wait=1`);
      await sleep(50);
    }
    done = true;
  })();
  await sleep(250);
  const seen = new Set();
  while (!done) {
    seen.add(await r.presence('codex-1'));
    await sleep(15);
  }
  await loop;
  assert.deepEqual([...seen], ['listening']);
});

test('an agent that posts once and goes quiet is working, then asleep, then leaves and frees its tasks', async () => {
  const r = await room();
  const a = await r.join('codex');
  await call('POST', `${a.link}/tasks`, { title: 'Write the CLI' });
  assert.equal((await call('POST', `${a.link}/tasks/1/claim`)).status, 200);
  await post(a, 'on it');
  await sleep(50);
  assert.equal(await r.presence('codex-1'), 'working');
  const seen = new Set();
  const end = Date.now() + 500;
  while (Date.now() < end) {
    seen.add(await r.presence('codex-1'));
    await sleep(25);
  }
  assert.ok(seen.has('working'));
  assert.ok(!seen.has('listening'));
  assert.equal(await r.presence('codex-1'), 'asleep');
  await sleep(600);
  r.huddle.sweep();
  assert.equal(await r.presence('codex-1'), 'left');
  const task = (await r.human('api/state')).json.tasks.find((t) => t.id === 1);
  assert.equal(task.status, 'open');
});

test('a working agent with a wait parked gets a mention at once and no quiet note', async () => {
  const r = await room();
  const a = await r.join('codex');
  const b = await r.join('opencode');
  await post(a, 'starting');
  const pending = call('GET', `${a.link}/wait?wait=5`);
  await sleep(100);
  assert.equal(await r.presence('codex-1'), 'working');
  await post(b, '@codex-1 ping');
  const res = await pending;
  assert.equal(res.status, 200);
  assert.ok(res.json.messages.some((m) => m.text.includes('@codex-1 ping')));
  assert.deepEqual(await r.notices(), []);
});

test('me?rest=1 shows asleep and does not count as work', async () => {
  const r = await room();
  const a = await r.join('codex');
  await post(a, 'starting');
  await sleep(150);
  await call('GET', `${a.link}/me?rest=1`);
  assert.equal(await r.presence('codex-1'), 'asleep');
  const pending = call('GET', `${a.link}/wait?wait=1`);
  await sleep(100);
  assert.equal(await r.presence('codex-1'), 'listening');
  await pending;
});

test('workingMinutes keeps an agent working until the declared end, then asleep', async () => {
  const r = await room({ activeMs: 100, asleepMs: 200, idleMs: 300, minuteMs: 150 });
  const a = await r.join('codex');
  assert.equal((await call('POST', `${a.link}/post`, { text: 'long job', workingMinutes: 4 })).status, 200);
  await sleep(350);
  assert.equal(await r.presence('codex-1'), 'working');
  const entry = (await r.human('api/state')).json.agents.find((x) => x.handle === 'codex-1');
  assert.ok(Date.parse(entry.workingUntil) > Date.now());
  r.huddle.sweep();
  assert.equal(await r.presence('codex-1'), 'working');
  await sleep(300);
  assert.equal(await r.presence('codex-1'), 'asleep');
  const after = (await r.human('api/state')).json.agents.find((x) => x.handle === 'codex-1');
  assert.equal(after.workingUntil, undefined);
});

test('workingMinutes outside 1 to 120 is refused before anything is posted', async () => {
  const r = await room();
  const a = await r.join('codex');
  const before = (await r.human('api/state')).json;
  for (const workingMinutes of [0, 121, 2.5, 'ten']) {
    const res = await call('POST', `${a.link}/post`, { text: 'x', workingMinutes });
    assert.equal(res.status, 400);
    assert.match(res.json.message, /workingMinutes must be a whole number from 1 to 120/);
  }
  const after = (await r.human('api/state')).json;
  assert.equal(after.messages.length, before.messages.length);
  assert.equal(after.agentStreak, before.agentStreak);
});

test('presence timers set in room settings show in state, post one system line and reset the streak', async () => {
  const r = await room({ activeMs: 100, asleepMs: 400, idleMs: 800 });
  const a = await r.join('codex');
  for (let i = 0; i < 7; i++) await post(a, `step ${i}`);
  assert.equal((await r.human('api/state')).json.agentStreak, 7);
  const pending = call('GET', `${a.link}/wait?wait=2`);
  await sleep(200);
  assert.equal(await r.presence('codex-1'), 'listening');
  const res = await r.human('api/settings', { workingWindowMinutes: 20 });
  assert.equal(res.status, 200);
  const state = (await r.human('api/state')).json;
  assert.equal(state.presenceTimers.workingWindowMinutes, 20);
  assert.equal(state.agentStreak, 0);
  assert.equal(state.messages.at(-1).text, 'you set presence timers: working 20 min, asleep 0 min, leave after 0 min, stall nudge after 5 min');
  assert.equal(await r.presence('codex-1'), 'working');
  assert.equal((await call('GET', `${a.link}/me`)).json.presenceTimers.workingWindowMinutes, 20);
  await pending;
});

test('presence timers outside their range, or leave not longer than asleep, are refused and change nothing', async () => {
  const r = await room({});
  const before = (await r.human('api/state')).json;
  assert.deepEqual(before.presenceTimers, { workingWindowMinutes: 10, asleepMinutes: 10, leaveMinutes: 15, stallMinutes: 5 });
  for (const [body, message] of [
    [{ workingWindowMinutes: 0 }, /workingWindowMinutes must be a whole number from 1 to 120/],
    [{ workingWindowMinutes: 'ten' }, /workingWindowMinutes must be a whole number from 1 to 120/],
    [{ asleepMinutes: 121 }, /asleepMinutes must be a whole number from 1 to 120/],
    [{ leaveMinutes: 4 }, /leaveMinutes must be a whole number from 5 to 240/],
    [{ leaveMinutes: 10 }, /leaveMinutes must be longer than asleepMinutes/],
    [{ workingWindowMinutes: 30, asleepMinutes: 20 }, /leaveMinutes must be longer than asleepMinutes/],
  ]) {
    const res = await r.human('api/settings', body);
    assert.equal(res.status, 400);
    assert.match(res.json.message, message);
  }
  const after = (await r.human('api/state')).json;
  assert.deepEqual(after.presenceTimers, before.presenceTimers);
  assert.equal(after.messages.length, before.messages.length);
});

test('the personal protocol explains presence with the room timers and how to declare working time', async () => {
  const r = await room({ activeMs: 20 * 60000 });
  const a = await r.join('claude');
  const protocol = (await call('GET', a.link)).text;
  assert.match(protocol, /Working long: .*"workingMinutes":25/);
  assert.match(protocol, /Working for\s+20 min after any call other than wait/);
  assert.match(protocol, /Listening while it\s+only waits/);
});

test('a wait that returns messages makes the agent working again', async () => {
  const r = await room();
  const a = await r.join('codex');
  const b = await r.join('opencode');
  const pending = call('GET', `${a.link}/wait?wait=5`);
  await sleep(300);
  assert.equal(await r.presence('codex-1'), 'listening');
  await post(b, '@codex-1 ping');
  assert.equal((await pending).status, 200);
  assert.equal(await r.presence('codex-1'), 'working');
  await sleep(300);
  await post(b, '@codex-1 again');
  assert.equal((await call('GET', `${a.link}/wait`)).status, 200);
  assert.equal(await r.presence('codex-1'), 'working');
});

test('auto-leave waits for the working window to end', async () => {
  const r = await room({ activeMs: 400, asleepMs: 200, idleMs: 300 });
  await r.join('codex');
  await sleep(350);
  r.huddle.sweep();
  assert.equal(await r.presence('codex-1'), 'working');
  await sleep(450);
  r.huddle.sweep();
  assert.equal(await r.presence('codex-1'), 'left');
});

test('leaving clears a declared working time from the roster', async () => {
  const r = await room();
  const a = await r.join('codex');
  await call('POST', `${a.link}/post`, { text: 'long job', workingMinutes: 30 });
  await call('POST', `${a.link}/leave`, {});
  const entry = (await r.human('api/state')).json.agents.find((x) => x.handle === 'codex-1');
  assert.equal(entry.presence, 'left');
  assert.equal(entry.workingUntil, undefined);
});
