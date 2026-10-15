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
const OFF_SHIFT = 'All tasks are done; you are off shift. Stop waiting and end your turn; @you or a reopened task brings you back.';

const TASKS = [
  { title: 'wordfreq CLI', assignee: 'claude-1' },
  { title: 'tests', assignee: 'opencode-1' },
  { title: 'README', assignee: 'dsh-1' },
  { title: 'review', assignee: 'claude-2' },
  { title: 'CHANGELOG.md entry' },
];

// codex-1 is the lead; claude-1, claude-2, opencode-1 and dsh-1 do the work.
async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const created = (await call('POST', `${base}/new`, { name: 'cumulative test' })).json;
  const join = async (harness, extra = {}) => (await call('POST', `${created.join}/join`, { harness, ...extra })).json;
  const lead = await join('codex', { lead: created.lead });
  const c1 = await join('claude');
  const c2 = await join('claude');
  const oc = await join('opencode');
  const dsh = await join('dsh');
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  return { huddle, base, created, join, state, lead, c1, c2, oc, dsh, agents: [lead, c1, c2, oc, dsh] };
}

const finish = (agent, n, note) => call('POST', `${agent.link}/tasks/${n}/done`, note === undefined ? {} : { note });

// Tasks #1-#4 are done (#3 without a note), #5 is claimed by opencode-1, and every agent has read the room.
async function nearlyDone(r) {
  for (const task of TASKS) await call('POST', `${r.lead.link}/tasks`, task);
  await call('POST', `${r.c1.link}/post`, { text: '@codex-1 #1 is in' });
  await finish(r.c1, 1, 'saved to wordfreq.mjs');
  await finish(r.oc, 2, 'test/wordfreq.test.mjs, 6 passing');
  await finish(r.dsh, 3);
  await finish(r.c2, 4, 'reviewed, no findings');
  await call('POST', `${r.oc.link}/tasks/5/claim`);
  for (const a of r.agents) await call('GET', `${a.link}/read?limit=500`);
}

const finishLast = (r) => finish(r.oc, 5, 'added the 0.1.0 entry');
const summaries = async (r) => (await r.state()).messages.filter((m) => m.from === 'system' && /^All \d+ tasks are done:/.test(m.text));

test('AC-88: finishing the last task sends you and the lead one summary from the done notes', async () => {
  const r = await room();
  await nearlyDone(r);
  assert.equal((await summaries(r)).length, 0);
  const before = (await r.state()).agentStreak;
  assert.equal(before, 1);

  const res = await finishLast(r);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal((await r.state()).agentStreak, before);

  const found = await summaries(r);
  assert.equal(found.length, 1);
  const [summary] = found;
  assert.equal(summary.kind, 'system');
  assert.equal(summary.toYou, true);
  assert.deepEqual(summary.to, ['codex-1']);
  assert.deepEqual(summary.mentions, ['codex-1']);
  assert.equal(
    summary.text,
    [
      'All 5 tasks are done:',
      '#1 "wordfreq CLI" by claude-1: saved to wordfreq.mjs',
      '#2 "tests" by opencode-1: test/wordfreq.test.mjs, 6 passing',
      '#3 "README" by dsh-1: no note',
      '#4 "review" by claude-2: reviewed, no findings',
      '#5 "CHANGELOG.md entry" by opencode-1: added the 0.1.0 entry',
    ].join('\n'),
  );
});

test('AC-89: every agent still in the room is sent off shift, and nobody gets a quiet note for it', async () => {
  const r = await room({ quietMs: 50, nudgeRepeatMs: 0 });
  const gone = await r.join('gemini');
  await nearlyDone(r);
  await call('POST', `${gone.link}/leave`);
  await call('GET', `${r.lead.link}/me?rest=1`);
  const parked = [r.c1, r.c2, r.oc, r.dsh].map((a) => call('GET', `${a.link}/wait?wait=25`));
  await sleep(100);
  const s = await r.state();
  assert.equal(s.agents.find((a) => a.handle === 'codex-1').presence, 'asleep');
  const since = s.messages.at(-1).id;

  await finishLast(r);
  for (const res of await Promise.all(parked)) {
    assert.equal(res.status, 200);
    assert.equal(res.json.offShift, true);
    const off = res.json.messages.find((m) => m.offShift);
    assert.equal(off.text, OFF_SHIFT);
    assert.equal(off.from, 'system');
  }

  const after = (await r.state()).messages.filter((m) => m.id > since);
  const off = after.filter((m) => m.offShift);
  assert.equal(off.length, 1);
  assert.deepEqual([...off[0].to].sort(), ['claude-1', 'claude-2', 'codex-1', 'dsh-1', 'opencode-1']);
  assert.ok(!off[0].to.includes(gone.handle));
  const quiet = after.filter((m) => m.toYou && /^(codex-1 |claude-|opencode-1 |dsh-1 |Not listening)/.test(m.text));
  assert.equal(quiet.length, 1, JSON.stringify(quiet.map((m) => m.text)));
  assert.match(quiet[0].text, /^codex-1 cannot be woken/);
  assert.ok(quiet[0].id < off[0].id);

  const lead = await call('GET', `${r.lead.link}/read?limit=500`);
  assert.equal(lead.json.offShift, true);
  assert.ok(lead.json.messages.some((m) => /^All 5 tasks are done:/.test(m.text)));
});

test('AC-90: all done ends nothing: past the idle time the room is listed, you can post and agents can add work', async () => {
  const r = await room({ activeMs: 50, asleepMs: 100, idleMs: 200 });
  await nearlyDone(r);
  await finishLast(r);
  await sleep(300);
  r.huddle.sweep();
  assert.ok((await r.state()).agents.every((a) => a.status === 'left'));

  const listed = await call('GET', `${r.base}/admin/rooms`, undefined, { authorization: 'Bearer admin' });
  assert.ok(listed.json.rooms.some((room) => room.id === r.created.id));
  const posted = await call('POST', `${r.created.page}/api/post`, { text: '@all one more thing' });
  assert.equal(posted.status, 200, JSON.stringify(posted.json));
  const made = await call('POST', `${r.c1.link}/tasks`, { title: 'follow-up' });
  assert.equal(made.status, 200, JSON.stringify(made.json));
  const claimed = await call('POST', `${r.c1.link}/tasks/${made.json.id}/claim`);
  assert.equal(claimed.status, 200, JSON.stringify(claimed.json));
  assert.equal(claimed.json.owner, 'claude-1');
});

test('AC-91: a reopen after all done wakes its owner, and finishing it again sends a second summary', async () => {
  const r = await room({ quietMs: 50 });
  await nearlyDone(r);
  await finishLast(r);
  await call('GET', `${r.c2.link}/read?limit=500`);
  await sleep(100);
  const since = (await r.state()).messages.at(-1).id;

  const reason = 'ties sort by count only';
  const reopened = await call('POST', `${r.c2.link}/tasks/1/reopen`, { reason });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.json));
  assert.equal(reopened.json.status, 'claimed');
  assert.equal(reopened.json.owner, 'claude-1');

  const after = (await r.state()).messages.filter((m) => m.id > since);
  const quiet = after.filter((m) => m.toYou && /^claude-1 is /.test(m.text));
  assert.equal(quiet.length, 1, JSON.stringify(after.map((m) => m.text)));

  const read = await call('GET', `${r.c1.link}/read?limit=500`);
  assert.ok(read.json.messages.some((m) => m.text === `claude-2 reopened task #1 "wordfreq CLI": ${reason}`));
  assert.equal(read.json.offShift, undefined);

  const again = await finish(r.c1, 1, 'ties now sort alphabetically');
  assert.equal(again.status, 200, JSON.stringify(again.json));
  const found = await summaries(r);
  assert.equal(found.length, 2);
  assert.ok(found[0].text.includes('#1 "wordfreq CLI" by claude-1: saved to wordfreq.mjs'));
  assert.ok(found[1].text.includes('#1 "wordfreq CLI" by claude-1: ties now sort alphabetically'));
  assert.equal((await r.state()).messages.filter((m) => m.offShift).length, 2);
});

test('a room with no tasks sends no summary and nobody off shift', async () => {
  const r = await room();
  await call('POST', `${r.c1.link}/post`, { text: '@claude-2 hi' });
  await call('POST', `${r.c2.link}/post`, { text: '@claude-1 hello' });
  const messages = (await r.state()).messages;
  assert.equal(messages.filter((m) => /tasks are done/.test(m.text)).length, 0);
  assert.equal(messages.filter((m) => m.offShift).length, 0);
});
