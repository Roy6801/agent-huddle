import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHuddle, errorBody } from '../skills/agent-huddle/huddle.mjs';

const running = [];
const dirs = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

async function call(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: body === undefined || typeof body !== 'object' ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, type: res.headers.get('content-type'), text, json };
}

const tmpDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-past-'));
  dirs.push(dir);
  return dir;
};

async function serve(historyDir, opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', historyDir, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  return { huddle, base: `http://127.0.0.1:${port}` };
}

// A room with a brief, a finished task, a shared file and a chat line, as fake agents would leave it.
async function busyRoom(base) {
  const created = (await call('POST', `${base}/new`, { name: 'past room' })).json;
  const lead = (await call('POST', `${created.join}/join`, { harness: 'codex', lead: created.lead })).json;
  const claude = (await call('POST', `${created.join}/join`, { harness: 'claude' })).json;
  await call('POST', `${lead.link}/brief`, 'Build a wordfreq CLI.', { 'content-type': 'text/markdown' });
  await call('POST', `${lead.link}/tasks`, { title: 'wordfreq CLI', assignee: 'claude-1' });
  await call('POST', `${claude.link}/tasks/1/claim`);
  await call('POST', `${claude.link}/tasks/1/done`, { note: 'shipped with tests' });
  const up = await call('POST', `${claude.link}/files?name=notes.txt`, 'hello', { 'content-type': 'text/plain' });
  await call('POST', `${claude.link}/post`, { text: '@codex-1 done, notes attached', files: [up.json.id] });
  return { created, tokens: [lead.link, claude.link].map((l) => l.split('/as/')[1]) };
}

function assertFullView(view, created, tokens) {
  assert.equal(view.room.name, 'past room');
  assert.ok(view.ended.at);
  assert.match(view.ended.transcript, /past-room-.{8}\.md$/);
  assert.equal(view.brief.text, 'Build a wordfreq CLI.');
  assert.equal(view.brief.by, 'codex-1');
  assert.deepEqual(view.tasks.map((t) => [t.id, t.title, t.status, t.owner, t.note]), [[1, 'wordfreq CLI', 'done', 'claude-1', 'shipped with tests']]);
  assert.deepEqual(view.agents.map((a) => [a.handle, a.harness]), [['codex-1', 'codex'], ['claude-1', 'claude']]);
  const post = view.messages.find((m) => m.from === 'claude-1');
  assert.equal(post.text, '@codex-1 done, notes attached');
  assert.deepEqual(post.files, [{ id: `${post.id}-0`, type: '', name: 'notes.txt', size: 5 }]);
  assert.ok(view.messages.some((m) => m.brief));
  const text = JSON.stringify(view);
  for (const t of [...tokens, created.lead, created.page.split('/h/')[1]]) assert.ok(!text.includes(t), 'no keys in the view');
}

test('AC-29.1: an ended room still in memory serves its page and its history', async () => {
  const { base } = await serve(tmpDir());
  const { created, tokens } = await busyRoom(base);
  await call('POST', `${base}/admin/rooms/${created.id}/end`, undefined, { authorization: 'Bearer admin' });

  const page = await call('GET', `${created.page}/`);
  assert.equal(page.status, 200);
  assert.match(page.type, /text\/html/);
  const history = await call('GET', `${created.page}/api/history`);
  assert.equal(history.status, 200);
  assertFullView(history.json, created, tokens);
  assert.equal(history.json.ended.reason, null);
  assert.equal((await call('GET', `${created.page}/api/state`)).status, 410);
});

test('AC-29.2: after a restart the room is read from its history file', async () => {
  const dir = tmpDir();
  const first = await serve(dir);
  const { created, tokens } = await busyRoom(first.base);
  await first.huddle.close();
  running.splice(running.indexOf(first.huddle), 1);

  const { base } = await serve(dir);
  const page = created.page.replace(first.base, base);
  const html = await call('GET', `${page}/`);
  assert.equal(html.status, 200);
  assert.match(html.type, /text\/html/);
  const history = await call('GET', `${page}/api/history`);
  assert.equal(history.status, 200);
  assertFullView(history.json, created, tokens);
  assert.equal(history.json.ended.reason, 'server stopped');

  const state = await call('GET', `${page}/api/state`);
  assert.equal(state.status, 410);
  assert.deepEqual(state.json, { ...errorBody('room_ended', { transcript: history.json.ended.transcript }), transcript: history.json.ended.transcript });
  assert.equal((await call('POST', `${page}/api/post`, { text: 'hi' })).status, 410);
  assert.equal((await call('GET', created.join.replace(first.base, base))).status, 404);
});

test('AC-29.2: a room whose tombstone expired is read from history too', async () => {
  const { base } = await serve(tmpDir(), { tombstoneMs: 20 });
  const { created, tokens } = await busyRoom(base);
  await call('POST', `${base}/admin/rooms/${created.id}/end`, undefined, { authorization: 'Bearer admin' });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const history = await call('GET', `${created.page}/api/history`);
  assert.equal(history.status, 200);
  assertFullView(history.json, created, tokens);
});

test('AC-29.3: a wrong page key or an agent key gets nothing, in memory or not', async () => {
  const dir = tmpDir();
  const first = await serve(dir);
  const { created, tokens } = await busyRoom(first.base);
  const wrong = (base, key) => `${base}/s/${created.id}/h/${key}`;
  await call('POST', `${first.base}/admin/rooms/${created.id}/end`, undefined, { authorization: 'Bearer admin' });
  for (const key of ['nope', tokens[0], created.lead]) {
    assert.equal((await call('GET', `${wrong(first.base, key)}/api/history`)).status, 401);
  }
  await first.huddle.close();
  running.splice(running.indexOf(first.huddle), 1);

  const { base } = await serve(dir);
  for (const key of ['nope', tokens[0], created.lead]) {
    for (const route of ['', '/api/history', '/api/state']) {
      const res = await call('GET', `${wrong(base, key)}${route}`);
      assert.equal(res.status, 401, `${key}${route}`);
      assert.deepEqual(res.json, errorBody('wrong_page_link'));
    }
  }
  const otherId = `${created.id.slice(0, 8)}${created.id[8] === 'x' ? 'y' : 'x'}${created.id.slice(9)}`;
  assert.equal((await call('GET', `${base}/s/${otherId}/h/${created.page.split('/h/')[1]}/api/history`)).status, 401);
  assert.equal((await call('GET', `${base}/s/unknownroom/h/key/api/history`)).status, 404);
});

test('AC-29.4: history from before the page hash shows only the transcript path', async () => {
  const dir = tmpDir();
  const id8 = 'oldroom1';
  const transcript = path.join(dir, `2026-10-01-old-${id8}.md`);
  const lines = [
    { type: 'room', at: '2026-10-01T10:00:00.000Z', name: 'old', id: id8, folder: null, createdAt: '2026-10-01T10:00:00.000Z', version: '0.3.0' },
    { type: 'message', at: '2026-10-01T10:01:00.000Z', id: 1, from: 'codex-1', text: 'secret plan', files: [] },
    { type: 'end', at: '2026-10-01T11:00:00.000Z', transcript },
  ];
  fs.writeFileSync(path.join(dir, `2026-10-01-old-${id8}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const { base } = await serve(dir);
  const page = `${base}/s/${id8}restofid/h/anykey`;
  assert.equal((await call('GET', `${page}/`)).status, 200);
  const history = await call('GET', `${page}/api/history`);
  assert.equal(history.status, 200);
  assert.deepEqual(history.json, { ended: { at: '2026-10-01T11:00:00.000Z', reason: null, transcript } });
});
