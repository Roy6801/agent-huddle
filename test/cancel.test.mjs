import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
const dirs = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
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

// codex-1 is the lead. codex-1 created #1 "parser" (for claude-1) and #3 "release" (after #1, for gemini-1);
// claude-1 created #2 "docs" (for gemini-1); codex-1 created #4 "publish" (after #1 and #2, for codex-1).
async function room() {
  const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cancel-'));
  dirs.push(historyDir);
  const huddle = createHuddle({ adminToken: 'admin', historyDir });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const created = (await call('POST', `${base}/new`, { name: 'cancel' })).json;
  const join = async (harness, extra = {}) => (await call('POST', `${created.join}/join`, { harness, ...extra })).json;
  const codex = await join('codex', { lead: created.lead });
  const claude = await join('claude');
  const gemini = await join('gemini');
  await call('POST', `${codex.link}/tasks`, { title: 'parser', assignee: 'claude-1' });
  await call('POST', `${claude.link}/tasks`, { title: 'docs', assignee: 'gemini-1' });
  await call('POST', `${codex.link}/tasks`, { title: 'release', assignee: 'gemini-1', after: [1] });
  await call('POST', `${codex.link}/tasks`, { title: 'publish', assignee: 'codex-1', after: [1, 2] });
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const task = async (n) => (await state()).tasks.find((t) => t.id === n);
  const line = async (re) => (await state()).messages.find((m) => re.test(m.text));
  const page = (n, action, body) => call('POST', `${created.page}/api/tasks/${n}/${action}`, body);
  const end = () => call('POST', `${base}/admin/rooms/${created.id}/end`, undefined, { authorization: 'Bearer admin' });
  const history = () => fs.readdirSync(historyDir).filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => fs.readFileSync(path.join(historyDir, f), 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l)));
  for (const a of [codex, claude, gemini]) await call('GET', `${a.link}/read?limit=500`);
  return { base, created, codex, claude, gemini, state, task, line, page, end, history };
}

test('AC-33.1: the lead cancels a claimed task with a reason; holder and creator are told and woken', async () => {
  const r = await room();
  await call('POST', `${r.gemini.link}/tasks/2/claim`);
  const parked = call('GET', `${r.gemini.link}/wait?wait=25`);
  await sleep(100);

  const res = await call('POST', `${r.codex.link}/tasks/2/cancel`, { reason: 'replaced by #4' });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.status, 'cancelled');
  assert.equal(res.json.owner, null);
  assert.equal(res.json.assignee, 'gemini-1');
  assert.equal(res.json.cancelled.by, 'codex-1');
  assert.equal(res.json.cancelled.reason, 'replaced by #4');

  const msg = await r.line(/cancelled task #2/);
  assert.equal(msg.text, 'codex-1 cancelled task #2 "docs" (held by @gemini-1): replaced by #4');
  assert.deepEqual(msg.mentions.sort(), ['claude-1', 'gemini-1']);
  assert.deepEqual(msg.to.sort(), ['claude-1', 'gemini-1']);
  const woken = await parked;
  assert.equal(woken.status, 200);
  assert.ok(woken.json.messages.some((m) => m.text === msg.text));

  const listed = (await call('GET', `${r.claude.link}/tasks`)).json.tasks.find((t) => t.id === 2);
  assert.equal(listed.status, 'cancelled');
  assert.equal(listed.cancelled.reason, 'replaced by #4');
});

test('AC-33.2: only the creator, the lead or you can cancel; finished tasks are refused', async () => {
  const r = await room();
  const stranger = await call('POST', `${r.gemini.link}/tasks/1/cancel`, { reason: 'mine now' });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.json.error, 'not_canceller');
  assert.equal(stranger.json.message, 'Task #1 was created by @codex-1; only its creator, the lead (@codex-1) or @you can cancel it.');
  assert.equal(stranger.json.instruction, 'Ask @codex-1 or @you to cancel it, and say why it is no longer needed.');
  const notCreator = await call('POST', `${r.gemini.link}/tasks/2/cancel`);
  assert.equal(notCreator.json.instruction, 'Ask @claude-1, @codex-1 or @you to cancel it, and say why it is no longer needed.');
  assert.equal((await r.task(1)).status, 'open');

  const creator = await call('POST', `${r.claude.link}/tasks/2/cancel`);
  assert.equal(creator.status, 200, JSON.stringify(creator.json));
  assert.equal(creator.json.cancelled.reason, null);
  assert.equal((await r.line(/cancelled task #2/)).text, 'claude-1 cancelled task #2 "docs"');

  const again = await r.page(2, 'cancel', {});
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'task_cancelled');
  assert.match(again.json.instruction, /tasks\/2\/reopen/);
  for (const action of ['claim', 'done', 'release']) {
    assert.equal((await call('POST', `${r.gemini.link}/tasks/2/${action}`)).json.error, 'task_cancelled', action);
  }
  assert.equal((await call('POST', `${r.claude.link}/tasks/2`, { title: 'docs v2' })).json.error, 'task_cancelled');
  assert.equal((await r.page(2, 'done')).json.error, 'task_cancelled');
  assert.equal((await r.page(2, 'assign', { assignee: 'codex-1' })).json.error, 'task_cancelled');

  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('POST', `${r.claude.link}/tasks/1/done`);
  assert.equal((await r.page(1, 'cancel')).json.error, 'task_done');
  assert.equal((await r.page(9, 'cancel')).status, 404);
  assert.equal((await r.page(3, 'cancel', { reason: '' })).json.error, 'invalid_text');
  assert.equal((await r.task(3)).status, 'open');

  await r.end();
  assert.equal((await r.page(3, 'cancel')).status, 410);
});

test('AC-33.3: tasks that waited only on a cancelled task are ready and their assignee is woken', async () => {
  const r = await room();
  const parked = call('GET', `${r.gemini.link}/wait?wait=25`);
  await sleep(100);

  const res = await r.page(1, 'cancel', { reason: 'parser ships upstream' });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const msg = await r.line(/cancelled task #1/);
  assert.equal(msg.text, 'you cancelled task #1 "parser": parser ships upstream');
  assert.deepEqual(msg.to.sort(), ['claude-1', 'codex-1', 'gemini-1']);

  assert.deepEqual((await r.task(3)).blocked, []);
  assert.deepEqual((await r.task(4)).blocked, [2]);
  const ready = (await r.state()).messages.filter((m) => /is ready/.test(m.text));
  assert.deepEqual(ready.map((m) => m.text), ['Task #3 "release" is ready: #1 is cancelled.']);
  assert.deepEqual(ready[0].to, ['gemini-1']);

  assert.equal((await parked).status, 200);
  const read = await call('GET', `${r.gemini.link}/read?limit=500`);
  const seen = [...(await parked).json.messages, ...read.json.messages].map((m) => m.text);
  assert.ok(seen.includes('Task #3 "release" is ready: #1 is cancelled.'));
  assert.equal((await call('POST', `${r.gemini.link}/tasks/3/claim`)).status, 200);

  await call('POST', `${r.gemini.link}/tasks/2/claim`);
  await call('POST', `${r.gemini.link}/tasks/2/done`, { note: 'docs written' });
  assert.ok(await r.line(/^Task #4 "publish" is ready: #1, #2 are done or cancelled\.$/));
});

test('AC-33.4: the all-done summary fires with a cancelled task and lists it separately', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await call('POST', `${r.claude.link}/tasks/1/done`, { note: 'parser.mjs' });
  await call('POST', `${r.gemini.link}/tasks/3/claim`);
  await call('POST', `${r.gemini.link}/tasks/3/done`, { note: 'tagged v1' });
  await call('POST', `${r.claude.link}/tasks/2/cancel`, { reason: 'README is enough' });
  assert.equal((await r.line(/tasks are/)), undefined);

  await call('POST', `${r.codex.link}/tasks/4/claim`);
  await call('POST', `${r.codex.link}/tasks/4/done`);
  const summary = await r.line(/^All 4 tasks are/);
  assert.equal(summary.text, [
    'All 4 tasks are finished (3 done, 1 cancelled):',
    '#1 "parser" by claude-1: parser.mjs',
    '#3 "release" by gemini-1: tagged v1',
    '#4 "publish" by codex-1: no note',
    'cancelled: #2 "docs" by claude-1: README is enough',
  ].join('\n'));
  assert.equal(summary.toYou, true);
  assert.deepEqual(summary.to, ['codex-1']);
  const off = await r.line(/off shift/);
  assert.equal(off.text, OFF_SHIFT);
  assert.deepEqual(off.to.sort(), ['claude-1', 'codex-1', 'gemini-1']);
});

test('AC-33.4: cancelling the last open task fires the summary', async () => {
  const r = await room();
  for (const n of [2, 3, 4]) await r.page(n, 'cancel');
  await r.page(1, 'done', { note: 'by hand' });
  const summary = await r.line(/^All 4 tasks are/);
  assert.match(summary.text, /^All 4 tasks are finished \(1 done, 3 cancelled\):\n#1 "parser" by you: by hand\ncancelled: #2 "docs" by you: no reason\n/);
});

test('AC-33.5: a cancelled task reopens as open for its assignee, who is woken, and its dependents wait again', async () => {
  const r = await room();
  await call('POST', `${r.claude.link}/tasks/1/claim`);
  await r.page(1, 'cancel', { reason: 'not needed' });
  await call('GET', `${r.claude.link}/read?limit=500`);
  const parked = call('GET', `${r.claude.link}/wait?wait=25`);
  await sleep(100);

  const res = await call('POST', `${r.gemini.link}/tasks/1/reopen`, { reason: 'needed after all' });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.status, 'open');
  assert.equal(res.json.owner, null);
  assert.equal(res.json.assignee, 'claude-1');
  assert.equal(res.json.cancelled, null);
  assert.equal(res.json.reopened.reason, 'needed after all');
  const msg = await r.line(/reopened task #1/);
  assert.equal(msg.text, 'gemini-1 reopened task #1 "parser": needed after all');
  assert.deepEqual(msg.to, ['claude-1']);
  assert.ok((await parked).json.messages.some((m) => m.text === msg.text));
  assert.deepEqual((await r.task(3)).blocked, [1]);
  assert.equal((await call('POST', `${r.claude.link}/tasks/1/claim`)).status, 200);
});

test('AC-33.7: history lines and the transcript show the cancel and its reason; the reference lists cancel', async () => {
  const r = await room();
  await r.page(2, 'cancel', { reason: 'README is enough' });
  const last = r.history().filter((l) => l.type === 'task' && l.task.id === 2).at(-1);
  assert.equal(last.task.status, 'cancelled');
  assert.equal(last.task.cancelled.reason, 'README is enough');

  const protocol = await (await fetch(r.codex.link)).text();
  assert.match(protocol, /Cancel task: +curl -s -X POST \S+\/tasks\/1\/cancel .*\(creator or lead; reason optional; tasks after it go ahead\)/);

  const ended = (await r.end()).json;
  const md = fs.readFileSync(ended.transcript, 'utf8');
  assert.match(md, /^- #2 docs \(cancelled by you\): README is enough$/m);
  assert.match(md, /^- #1 parser \(open\)$/m);
});
