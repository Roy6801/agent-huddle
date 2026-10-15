import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function start(opts = {}) {
  const huddle = createHuddle(opts);
  const port = await huddle.listen(0);
  running.push(huddle);
  return { huddle, base: `http://127.0.0.1:${port}` };
}

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
  return { status: res.status, json, text, headers: res.headers };
}

async function room(opts) {
  const { huddle, base } = await start(opts);
  const { json: created } = await call('POST', `${base}/new`, { name: 'test room' });
  const join = async (harness, role) => {
    const { json } = await call('POST', `${created.join}/join`, { harness, ...(role ? { role } : {}) });
    return json;
  };
  const human = (path, body) => call(body ? 'POST' : 'GET', `${created.page}/${path}`, body);
  const state = async () => (await human('api/state')).json;
  return { huddle, base, created, join, human, state };
}

const taskList = async (agent) => (await call('GET', `${agent.link}/tasks`)).json.tasks;

test('task create: invalid description, spec or file is refused and nothing changes', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  const upload = await fetch(`${codex.link}/files?name=spec-wordfreq.md`, {
    method: 'POST',
    headers: { 'content-type': 'text/markdown' },
    body: '# word frequency',
  });
  const file = await upload.json();
  const messagesBefore = (await r.state()).messages.length;

  const cases = [
    [{ description: 'd'.repeat(2001) }, 'description must be 1-2000 characters'],
    [{ spec: 's'.repeat(20001) }, 'spec must be 1-20000 characters'],
    [{ specFile: 'nope' }, 'unknown file'],
    [{ spec: 'text', specFile: file.id }, 'send spec or specFile, not both'],
  ];
  for (const [fields, error] of cases) {
    const wait = fetch(`${claude.link}/wait?wait=1`);
    const res = await call('POST', `${codex.link}/tasks`, { title: 'bad', assignee: 'claude-1', ...fields });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, error);
    if (error === 'unknown file') assert.deepEqual(res.json.valid, [file.id]);
    assert.equal((await wait).status, 204);
    assert.equal((await taskList(codex)).length, 0);
    assert.equal((await r.state()).messages.length, messagesBefore);
  }
});

test('task create: a long non-Latin spec is accepted, a body over 128 KB is refused', async () => {
  const r = await room();
  const codex = await r.join('codex');
  await r.join('claude');
  const ok = await call('POST', `${codex.link}/tasks`, {
    title: 'wide',
    assignee: 'claude-1',
    description: '字'.repeat(2000),
    spec: '字'.repeat(20000),
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.spec.length, 20000);

  const tooBig = await call('POST', `${codex.link}/tasks`, { title: 'huge', spec: 'x'.repeat(129 * 1024) });
  assert.equal(tooBig.status, 413);
  const tooBigPage = await r.human('api/tasks', { title: 'huge', spec: 'x'.repeat(129 * 1024) });
  assert.equal(tooBigPage.status, 413);
  assert.equal((await taskList(codex)).length, 1);
});

test('task create: a title-only task still works', async () => {
  const r = await room();
  const codex = await r.join('codex');
  await r.join('claude');
  const res = await call('POST', `${codex.link}/tasks`, { title: 'draw sprite', assignee: 'claude-1' });
  assert.equal(res.status, 200);
  assert.equal(res.json.description, null);
  assert.equal(res.json.spec, null);
  assert.equal(res.json.specFile, null);
  const [task] = await taskList(codex);
  assert.equal(task.title, 'draw sprite');
  assert.equal(task.specSize, 0);
});

test('read task: full task by id, the list carries the spec size only', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  const opencode = await r.join('opencode');
  const spec = 'x'.repeat(4000);
  await call('POST', `${codex.link}/tasks`, { title: 'wordfreq', description: 'count words', spec, assignee: claude.handle });

  const one = await call('GET', `${opencode.link}/tasks/1`);
  assert.equal(one.status, 200);
  assert.equal(one.json.title, 'wordfreq');
  assert.equal(one.json.description, 'count words');
  assert.equal(one.json.spec, spec);
  assert.equal(one.json.status, 'open');
  assert.equal(one.json.owner, null);
  assert.equal(one.json.assignee, 'claude-1');
  assert.equal(one.json.createdBy, 'codex-1');

  const [listed] = await taskList(opencode);
  assert.equal(listed.specSize, 4000);
  assert.equal(listed.description, 'count words');
  assert.ok(!('spec' in listed));

  assert.equal((await call('GET', `${opencode.link}/tasks/9`)).status, 404);
  assert.equal((await r.state()).tasks[0].spec, spec);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const parkWait = async (agent) => {
  const pending = fetch(`${agent.link}/wait?wait=5`).then((res) => res.json());
  await sleep(200);
  return pending;
};
const forTask = (payload, n) => payload.messages.find((m) => m.task === n);

test('wake: the assignee gets description and spec in its wake, a title-only task gets nulls', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  const description = 'd'.repeat(600);
  const spec = 's'.repeat(4000);

  let wait = parkWait(claude);
  await call('POST', `${codex.link}/tasks`, { title: 'Implement wordfreq CLI', assignee: claude.handle, description, spec });
  const full = forTask(await wait, 1);
  assert.equal(full.taskDetail.title, 'Implement wordfreq CLI');
  assert.equal(full.taskDetail.description, description);
  assert.equal(full.taskDetail.spec, spec);

  wait = parkWait(claude);
  await call('POST', `${codex.link}/tasks`, { title: 'draw sprite', assignee: claude.handle });
  const bare = forTask(await wait, 2);
  assert.equal(bare.text, 'codex-1 created task #2 "draw sprite" for @claude-1');
  assert.equal(bare.taskDetail.description, null);
  assert.equal(bare.taskDetail.spec, null);
  assert.equal(bare.taskDetail.specFile, null);
});

test('wake: other agents read the creation message without detail, a claim reply carries the task', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  const opencode = await r.join('opencode');
  const dsh = await r.join('dsh');
  await call('POST', `${codex.link}/tasks`, { title: 'wordfreq', assignee: claude.handle, description: 'count words', spec: 'the spec' });

  const read = (await call('GET', `${opencode.link}/read`)).json;
  const seen = forTask(read, 1);
  assert.ok(seen);
  assert.ok(!('taskDetail' in seen));
  assert.ok(!('taskDetail' in (await r.state()).messages.find((m) => m.task === 1)));

  await call('POST', `${codex.link}/tasks`, { title: 'CHANGELOG.md entry, first to claim', description: 'add a line', spec: 'under Unreleased' });
  const claim = await call('POST', `${dsh.link}/tasks/2/claim`);
  assert.equal(claim.json.owner, 'dsh-1');
  assert.equal(claim.json.description, 'add a line');
  assert.equal(claim.json.spec, 'under Unreleased');
});

test('wake: a spec file arrives with a download command that fetches the exact bytes', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const opencode = await r.join('opencode');
  const body = '# wordfreq\n' + 'count the words, ignore case\n'.repeat(320);
  const upload = await fetch(`${codex.link}/files?name=spec-wordfreq.md`, {
    method: 'POST',
    headers: { 'content-type': 'text/markdown' },
    body,
  });
  const file = await upload.json();

  const wait = parkWait(opencode);
  await call('POST', `${codex.link}/tasks`, { title: 'Write and run CLI tests', assignee: opencode.handle, specFile: file.id });
  const { specFile } = forTask(await wait, 1).taskDetail;
  assert.equal(specFile.id, file.id);
  assert.equal(specFile.name, 'spec-wordfreq.md');
  assert.equal(specFile.size, Buffer.byteLength(body));
  assert.ok(specFile.download.includes(`${opencode.link}/files/${file.id}`));

  const got = (await call('GET', `${opencode.link}/tasks/1`)).json.specFile;
  assert.deepEqual(got, specFile);
  const url = /(http:\/\/\S+)$/.exec(specFile.download)[1];
  assert.equal(await (await fetch(url)).text(), body);
});

test('edit: the creator or you edit a task, the owner is woken with the new detail, the streak is untouched by agents', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  await call('POST', `${codex.link}/tasks`, { title: 'wordfreq', assignee: claude.handle, spec: 'old spec' });
  await call('POST', `${claude.link}/tasks/1/claim`);
  await call('GET', `${claude.link}/read`);

  const streak = async () => (await r.state()).agentStreak;
  const before = await streak();
  let wait = parkWait(claude);
  const edit = await call('POST', `${codex.link}/tasks/1`, { spec: 'ties sort alphabetically by word' });
  assert.equal(edit.status, 200);
  assert.equal(edit.json.spec, 'ties sort alphabetically by word');
  const woken = forTask(await wait, 1);
  assert.ok(woken.text.includes('codex-1 edited task #1'));
  assert.equal(woken.taskDetail.spec, 'ties sort alphabetically by word');
  assert.equal(await streak(), before);

  for (let i = 0; i < 3; i++) await call('POST', `${codex.link}/post`, { text: `chat ${i}` });
  assert.ok((await streak()) > 0);
  await call('GET', `${claude.link}/read`);
  wait = parkWait(claude);
  const human = await r.human('api/tasks/1', { description: 'new desc' });
  assert.equal(human.status, 200);
  assert.equal(forTask(await wait, 1).taskDetail.description, 'new desc');
  assert.equal(await streak(), 0);

  await call('POST', `${codex.link}/tasks`, { title: 'loose' });
  await call('POST', `${codex.link}/tasks/2`, { description: 'edited' });
  const last = (await r.state()).messages.at(-1);
  assert.equal(last.task, 2);
  assert.deepEqual(last.to, []);
});

test('edit: only the creator or you may edit, a refused edit changes nothing', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  const dsh = await r.join('dsh');
  await call('POST', `${codex.link}/tasks`, { title: 'wordfreq', assignee: claude.handle, description: 'keep' });
  await call('POST', `${claude.link}/tasks/1/claim`);
  const count = async () => (await r.state()).messages.length;
  const before = await count();

  for (const who of [dsh, claude]) {
    const res = await call('POST', `${who.link}/tasks/1`, { description: 'x' });
    assert.equal(res.status, 403);
    assert.equal(res.json.error, 'only the creator or you can edit task #1');
  }
  assert.equal((await call('GET', `${codex.link}/tasks/1`)).json.description, 'keep');
  assert.equal(await count(), before);
});

test('edit: done tasks and empty bodies are refused, null removes the spec, a file replaces the spec', async () => {
  const r = await room();
  const codex = await r.join('codex');
  const claude = await r.join('claude');
  const upload = await fetch(`${codex.link}/files?name=spec.md`, {
    method: 'POST',
    headers: { 'content-type': 'text/markdown' },
    body: '# spec',
  });
  const file = await upload.json();
  await call('POST', `${codex.link}/tasks`, { title: 'one', spec: 'text spec' });
  await call('POST', `${codex.link}/tasks`, { title: 'two' });

  const empty = await call('POST', `${codex.link}/tasks/1`, {});
  assert.equal(empty.status, 400);
  assert.equal(empty.json.error, 'send description, spec or specFile');

  const viaFile = await call('POST', `${codex.link}/tasks/1`, { specFile: file.id });
  assert.equal(viaFile.json.spec, null);
  assert.equal(viaFile.json.specFile.id, file.id);
  const viaText = await call('POST', `${codex.link}/tasks/1`, { spec: 'text again' });
  assert.equal(viaText.json.specFile, null);
  assert.equal(viaText.json.spec, 'text again');
  const removed = await call('POST', `${codex.link}/tasks/1`, { spec: null });
  assert.equal(removed.json.spec, null);

  await call('POST', `${claude.link}/tasks/2/done`);
  const done = await call('POST', `${codex.link}/tasks/2`, { description: 'late' });
  assert.equal(done.status, 409);
  assert.equal(done.json.error, 'task is done');
});

test('the personal protocol lists the create, read and edit task calls', async () => {
  const r = await room();
  const a = await r.join('claude');
  const protocol = (await call('GET', a.link)).text;
  assert.match(protocol, /Create task: .*"description":/);
  assert.match(protocol, /-d @task\.json/);
  assert.match(protocol, new RegExp(`Read task: +curl -s ${a.link}/tasks/1`));
  assert.match(protocol, new RegExp(`Edit task: +curl -s -X POST ${a.link}/tasks/1 `));
});
