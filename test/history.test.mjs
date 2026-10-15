import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const running = [];
const dirs = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
  while (dirs.length) {
    const dir = dirs.pop();
    fs.chmodSync(dir, 0o700);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function call(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const tmpDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-history-'));
  dirs.push(dir);
  return dir;
};

async function room(name, opts = {}) {
  const historyDir = opts.historyDir ?? tmpDir();
  const huddle = createHuddle({ adminToken: 'admin', historyDir, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = (await call('POST', `http://127.0.0.1:${port}/new`, { name })).json;
  const join = async (b) => (await call('POST', `${created.join}/join`, b)).json;
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  const files = () => fs.readdirSync(historyDir).filter((f) => f.endsWith('.jsonl'));
  const text = () => fs.readFileSync(path.join(historyDir, files()[0]), 'utf8');
  const lines = () => text().trimEnd().split('\n').map((l) => JSON.parse(l));
  return { created, join, state, historyDir, files, text, lines };
}

test('AC-93: a live room is appended to one dated file, starting with the room line', async () => {
  const r = await room('cumulative test');
  const codex = await r.join({ harness: 'codex', lead: r.created.lead });
  const claude = await r.join({ harness: 'claude' });
  assert.equal((await call('POST', `${codex.link}/brief`, 'Build a wordfreq CLI.', { 'content-type': 'text/markdown' })).status, 200);
  assert.equal((await call('POST', `${codex.link}/tasks`, { title: 'wordfreq CLI', assignee: 'claude-1' })).status, 200);
  assert.equal((await call('POST', `${claude.link}/post`, { text: '@codex-1 on it' })).status, 200);

  const id8 = r.created.id.slice(0, 8);
  const files = r.files();
  assert.equal(files.length, 1);
  assert.match(files[0], new RegExp(`^\\d{4}-\\d{2}-\\d{2}-cumulative-test-${id8}\\.jsonl$`));
  assert.equal(fs.statSync(path.join(r.historyDir, files[0])).mode & 0o777, 0o600);

  const lines = r.lines();
  const [first] = lines;
  assert.equal(first.type, 'room');
  assert.equal(first.name, 'cumulative test');
  assert.equal(first.id, id8);
  assert.equal(first.folder, null);
  assert.equal(first.createdAt.slice(0, 10), files[0].slice(0, 10));

  const messages = lines.filter((l) => l.type === 'message');
  const ids = messages.map((m) => m.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.deepEqual(ids, (await r.state()).messages.map((m) => m.id));
  assert.ok(messages.some((m) => m.brief && m.text === 'Build a wordfreq CLI.'));
  assert.ok(messages.some((m) => m.from === 'claude-1' && m.text === '@codex-1 on it'));

  const tasks = lines.filter((l) => l.type === 'task');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].task.title, 'wordfreq CLI');
  assert.equal(tasks[0].task.assignee, 'claude-1');
  assert.deepEqual(lines.filter((l) => l.type === 'agent').map((l) => l.handle), ['codex-1', 'claude-1']);
});

test('AC-93: every task change is one task line, and leaving releases are recorded', async () => {
  const r = await room('changes');
  const codex = await r.join({ harness: 'codex' });
  const claude = await r.join({ harness: 'claude' });
  await call('POST', `${codex.link}/tasks`, { title: 'one' });
  await call('POST', `${codex.link}/tasks/1`, { description: 'more' });
  await call('POST', `${claude.link}/tasks/1/claim`);
  await call('POST', `${claude.link}/tasks/1/claim`);
  await call('POST', `${claude.link}/tasks/1/release`);
  await call('POST', `${claude.link}/tasks/1/claim`);
  await call('POST', `${claude.link}/tasks/1/done`, { note: 'shipped' });
  await call('POST', `${r.created.page}/api/tasks/1/reopen`, { reason: 'one more case' });
  await call('POST', `${claude.link}/leave`);
  await call('GET', `${claude.link}/me`);

  const lines = r.lines();
  const tasks = lines.filter((l) => l.type === 'task').map((l) => [l.task.status, l.task.owner]);
  assert.deepEqual(tasks, [
    ['open', null],
    ['open', null],
    ['claimed', 'claude-1'],
    ['open', null],
    ['claimed', 'claude-1'],
    ['done', 'claude-1'],
    ['claimed', 'claude-1'],
    ['open', null],
  ]);
  const done = lines.find((l) => l.type === 'task' && l.task.status === 'done');
  assert.equal(done.task.note, 'shipped');
  const agents = lines.filter((l) => l.type === 'agent' && l.handle === 'claude-1').map((l) => l.status);
  assert.deepEqual(agents, ['active', 'left', 'active']);
});

test('AC-93: asks are recorded as they are created and settled', async () => {
  const r = await room('asks');
  const codex = await r.join({ harness: 'codex' });
  const options = [{ optionId: 'y', kind: 'allow_once', name: 'Yes' }];
  await call('POST', `${codex.link}/asks`, { title: 'Run tests?', options });
  await call('POST', `${r.created.page}/api/asks/1`, { optionId: 'y' });
  const asks = r.lines().filter((l) => l.type === 'ask').map((l) => l.ask.status);
  assert.deepEqual(asks, ['open', 'answered']);
});

test('AC-94: history keeps every message past the 2000 the room holds', async () => {
  const r = await room('long', { roundCap: null });
  for (let i = 1; i <= 2100; i++) {
    assert.equal((await call('POST', `${r.created.page}/api/post`, { text: `message ${i}` })).status, 200);
  }
  const st = await r.state();
  assert.equal(st.messages.length, 500);
  const all = [];
  for (let since = 0; ; ) {
    const page = (await call('GET', `${r.created.page}/api/state?since=${since}`)).json.messages;
    if (!page.length) break;
    all.push(...page);
    since = page.at(-1).id;
  }
  assert.equal(all.length, 2000);
  const texts = r.lines().filter((l) => l.type === 'message').map((l) => l.text);
  assert.equal(texts.length, 2100);
  assert.deepEqual(texts, Array.from({ length: 2100 }, (_, i) => `message ${i + 1}`));
});

test('AC-97: an unwritable history folder tells you once and the room still works', { skip: process.getuid?.() === 0 }, async () => {
  const historyDir = tmpDir();
  fs.chmodSync(historyDir, 0o500);
  const r = await room('readonly', { historyDir });
  const codex = await r.join({ harness: 'codex' });
  assert.equal((await call('POST', `${codex.link}/post`, { text: 'hello' })).status, 200);
  assert.equal((await call('POST', `${codex.link}/tasks`, { title: 'one' })).status, 200);
  assert.equal((await call('POST', `${codex.link}/tasks/1/done`)).status, 200);
  const notices = (await r.state()).messages.filter((m) => m.text.startsWith('History is not being saved for this room'));
  assert.equal(notices.length, 1);
  assert.equal(notices[0].toYou, true);
  assert.equal(notices[0].kind, 'system');
  assert.deepEqual(r.files(), []);
});

test('history holds no page token, agent link, lead key or full room id', async () => {
  const r = await room('secrets');
  const codex = await r.join({ harness: 'codex', lead: r.created.lead });
  const child = (await call('POST', `${codex.link}/spawn`, { role: 'reviewer' })).json;
  const up = await fetch(`${codex.link}/files?name=spec.md`, { method: 'POST', body: 'spec' });
  const file = await up.json();
  const made = await call('POST', `${codex.link}/tasks`, { title: 'spec', specFile: file.id, assignee: 'codex-1.reviewer' });
  assert.match(made.json.specFile.download, /^curl /);
  assert.equal((await call('POST', `${codex.link}/post`, { text: 'see file', files: [file.id] })).status, 200);
  assert.equal((await call('POST', `${child.link}/tasks/1/claim`)).status, 200);
  const text = r.text();
  const pageToken = r.created.page.split('/h/')[1];
  for (const secret of [r.created.id, pageToken, r.created.lead, r.created.join, codex.token, codex.link, child.token, child.link, 'curl']) {
    assert.ok(!text.includes(secret), `history leaks ${secret}`);
  }
  assert.ok(text.includes('"name":"spec.md"'));
});

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const run = (env, ...args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
  });

test('the server writes history under AGENT_HUDDLE_HOME', async () => {
  const home = tmpDir();
  const env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
  try {
    const made = await run(env, 'new', 'home room');
    assert.equal(made.code, 0, made.stderr);
    const { id } = JSON.parse(made.stdout);
    const files = fs.readdirSync(path.join(home, 'history'));
    assert.deepEqual(files.map((f) => f.slice(11)), [`home-room-${id.slice(0, 8)}.jsonl`]);
    assert.equal(fs.statSync(path.join(home, 'history')).mode & 0o777, 0o700);
  } finally {
    await run(env, 'down');
  }
});
