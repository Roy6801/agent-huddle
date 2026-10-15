import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function call(method, url, body, headers = {}) {
  const plain = typeof body === 'string';
  const res = await fetch(url, {
    method,
    headers: body === undefined || plain ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined || plain ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function room(body = {}) {
  const huddle = createHuddle({ adminToken: 'admin' });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = (await call('POST', `http://127.0.0.1:${port}/new`, { name: 'brief', ...body })).json;
  const join = async (b) => (await call('POST', `${created.join}/join`, b)).json;
  const state = async () => (await call('GET', `${created.page}/api/state`)).json;
  return { created, join, state };
}

const BRIEF = [
  'Project: a tiny Node CLI in this folder',
  '',
  ...Array.from({ length: 35 }, (_, i) => (i % 3 === 0 ? `- step ${i}` : `  indented line ${i}`)),
  '```js',
  'console.log("hi");',
  '```',
  '',
].join('\n');

const briefMessages = (st) => st.messages.filter((m) => m.brief);

test('AC-64: the lead\'s brief is pinned byte-identical and survives 60 messages', async () => {
  const { created, join, state } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  await join({ harness: 'claude' });
  assert.equal(BRIEF.split('\n').length, 41);

  const set = await call('POST', `${codex.link}/brief`, { text: BRIEF });
  assert.equal(set.status, 200);
  let st = await state();
  const [m] = briefMessages(st);
  assert.equal(m.from, 'system');
  assert.equal(m.text, BRIEF);
  assert.deepEqual(m.to, ['claude-1']);
  assert.equal(st.brief.text, BRIEF);
  assert.equal(st.brief.by, 'codex-1');

  for (let i = 0; i < 60; i++) await call('POST', `${created.page}/api/post`, { text: `chatter ${i}` });
  st = await state();
  assert.equal(st.brief.text, BRIEF);
  assert.equal(st.brief.id, m.id);
});

test('AC-64: you set the brief through the page, JSON or raw markdown, and setting again replaces the pin', async () => {
  const { created, join, state } = await room();
  await join({ harness: 'codex', lead: created.lead });
  const api = `${created.page}/api/brief`;

  assert.equal((await call('POST', api, { text: BRIEF })).status, 200);
  let st = await state();
  assert.equal(st.brief.text, BRIEF);
  assert.equal(st.brief.by, 'you');
  assert.deepEqual(briefMessages(st)[0].to, ['codex-1']);
  const first = st.brief.id;

  assert.equal((await call('POST', api, BRIEF, { 'content-type': 'text/markdown' })).status, 200);
  st = await state();
  assert.equal(st.brief.text, BRIEF);
  assert.notEqual(st.brief.id, first);
  assert.equal(briefMessages(st).length, 2);
});

test('a raw text/markdown body from the lead arrives byte-identical', async () => {
  const { created, join, state } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  assert.equal((await call('POST', `${codex.link}/brief`, BRIEF, { 'content-type': 'text/markdown' })).status, 200);
  assert.equal((await state()).brief.text, BRIEF);
});

test('the brief post wakes a listening agent', async () => {
  const { created, join } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  const claude = await join({ harness: 'claude' });
  const waiting = call('GET', `${claude.link}/wait?wait=5`);
  await new Promise((r) => setTimeout(r, 100));
  await call('POST', `${codex.link}/brief`, { text: BRIEF });
  const woke = await waiting;
  assert.equal(woke.status, 200);
  assert.ok(woke.json.messages.some((m) => m.brief && m.text === BRIEF));
});

test('AC-65: only the lead or you can set the brief', async () => {
  const { created, join, state } = await room();
  await join({ harness: 'codex', lead: created.lead });
  const claude = await join({ harness: 'claude' });
  await call('POST', `${created.page}/api/brief`, { text: 'pinned' });
  const before = (await state()).messages.length;

  const res = await call('POST', `${claude.link}/brief`, { text: 'mine' });
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'not_lead');
  assert.match(res.json.message, /@codex-1/);
  const st = await state();
  assert.equal(st.messages.length, before);
  assert.equal(st.brief.text, 'pinned');
});

test('AC-65: a room with no lead says only @you can set it', async () => {
  const { join } = await room();
  const claude = await join({ harness: 'claude' });
  const res = await call('POST', `${claude.link}/brief`, { text: 'mine' });
  assert.equal(res.status, 403);
  assert.match(res.json.message, /no lead, so only @you/);
});

test('a brief over 20,000 characters or blank is refused and nothing is posted', async () => {
  const { created, join, state } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  const before = (await state()).messages.length;
  for (const text of ['x'.repeat(20001), '   ']) {
    const res = await call('POST', `${codex.link}/brief`, { text });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'invalid_text');
  }
  const st = await state();
  assert.equal(st.messages.length, before);
  assert.equal(st.brief, null);
});

test('the lead\'s brief does not count as an agent round', async () => {
  const { created, join, state } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  await call('POST', `${codex.link}/post`, { text: 'hello' });
  assert.equal((await state()).agentStreak, 1);
  await call('POST', `${codex.link}/brief`, { text: BRIEF });
  assert.equal((await state()).agentStreak, 1);
});

test('GET brief returns the pin to any agent, null before', async () => {
  const { created, join } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  const claude = await join({ harness: 'claude' });
  assert.deepEqual((await call('GET', `${claude.link}/brief`)).json, { brief: null });
  await call('POST', `${codex.link}/brief`, { text: BRIEF });
  assert.equal((await call('GET', `${claude.link}/brief`)).json.brief.text, BRIEF);
});

test('AC-66: every join reply, the personal reference and /me carry the folder and the brief', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-brief-'));
  const { created, join } = await room({ folder: dir });
  const codex = await join({ harness: 'codex', lead: created.lead });
  await call('POST', `${codex.link}/brief`, { text: BRIEF });

  const claude = await join({ harness: 'claude' });
  assert.equal(claude.brief, BRIEF);
  assert.equal(claude.folder, dir);
  const reference = await (await fetch(claude.link)).text();
  assert.ok(reference.includes(`Room folder: ${dir}`));
  assert.ok(reference.includes(BRIEF));
  assert.equal((await call('GET', `${claude.link}/me`)).json.folder, dir);

  const child = (await call('POST', `${claude.link}/spawn`, { role: 'tester' })).json;
  assert.equal(child.brief, BRIEF);
  assert.equal(child.folder, dir);
});

test('AC-67: a joiner before the brief is told, then woken by it', async () => {
  const { created, join } = await room();
  const codex = await join({ harness: 'codex', lead: created.lead });
  const claude = await join({ harness: 'claude' });
  assert.equal(claude.brief, null);
  assert.equal(claude.folder, null);
  assert.match(claude.note, /No brief yet/);

  const parked = call('GET', `${claude.link}/wait?wait=5`);
  await new Promise((r) => setTimeout(r, 100));
  await call('POST', `${codex.link}/brief`, { text: BRIEF });
  const woken = (await parked).json;
  assert.equal(woken.messages.find((m) => m.brief).text, BRIEF);
  assert.equal((await call('GET', `${claude.link}/brief`)).json.brief.text, BRIEF);
});
