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
const QUIET = 50;

async function room(opts = {}) {
  const huddle = createHuddle({ quietMs: QUIET, ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const { json: created } = await call('POST', `http://127.0.0.1:${port}/new`, { name: 'roles' });
  const join = async (body) => (await call('POST', `${created.join}/join`, body)).json;
  const human = (path, body) => call(body ? 'POST' : 'GET', `${created.page}/${path}`, body);
  const state = async () => (await human('api/state')).json;
  const roster = async (handle) => (await state()).agents.find((a) => a.handle === handle);
  const post = (agent, text) => call('POST', `${agent.link}/post`, { text });
  return { huddle, created, join, human, state, roster, post };
}

test('a headless agent can hold a real role: @role reaches it and it stays headless everywhere', async () => {
  const r = await room();
  const lead = await r.join({ harness: 'claude', lead: r.created.lead });
  const h = await r.join({ harness: 'codex', headless: true, role: 'builder' });
  assert.equal(h.role, 'builder');

  const seen = await r.roster('codex-1');
  assert.equal(seen.role, 'builder');
  assert.equal(seen.headless, true);
  assert.equal((await r.roster('claude-1')).headless, undefined);
  assert.equal((await call('GET', `${lead.link}/who`)).json.agents.find((a) => a.handle === 'codex-1').headless, true);

  const sent = await r.post(lead, '@builder start on #1');
  assert.equal(sent.status, 200);
  assert.deepEqual((await r.state()).messages.find((m) => m.id === sent.json.id).to, ['codex-1']);

  const protocol = (await call('GET', h.link)).text;
  assert.match(protocol, /^You are codex-1 \(role builder\)/);
  assert.doesNotMatch(protocol, /Wait \(<=25s\):|Leave:|Page approvals:/);

  await sleep(QUIET + 30);
  await r.human('api/post', { text: '@builder ping' });
  assert.equal((await r.state()).messages.filter((m) => /Not listening|not waiting/.test(m.text)).length, 0);

  assert.equal((await r.human('api/agents/codex-1/stop', {})).status, 200);
  assert.equal((await r.human('api/agents/claude-1/stop', {})).json.error, 'not_headless');
});

test('role headless from an old client marks the agent headless with no role', async () => {
  const r = await room();
  const h = await r.join({ harness: 'gemini', role: 'headless' });
  assert.equal(h.role, null);
  const seen = await r.roster('gemini-1');
  assert.equal(seen.headless, true);
  assert.equal(seen.role, null);
  assert.ok((await r.state()).messages.some((m) => m.text === 'gemini-1 joined headless'));
  assert.equal((await r.human('api/agents/gemini-1/stop', {})).status, 200);
});

test('headless is not a role an agent can spawn', async () => {
  const r = await room();
  const a = await r.join({ harness: 'claude' });
  const res = await call('POST', `${a.link}/spawn`, { role: 'headless' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'invalid_role');
});

test('an agent changes its own role: a steward line, @role follows, history keeps it', async (t) => {
  const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-roles-'));
  t.after(() => fs.rmSync(historyDir, { recursive: true, force: true }));
  const r = await room({ historyDir });
  const lead = await r.join({ harness: 'claude', lead: r.created.lead });
  const codex = await r.join({ harness: 'codex', role: 'tester' });

  const changed = await call('POST', `${codex.link}/role`, { role: 'builder' });
  assert.equal(changed.status, 200);
  assert.equal(changed.json.role, 'builder');
  assert.equal((await r.roster('codex-1')).role, 'builder');
  assert.equal((await call('GET', `${codex.link}/me`)).json.role, 'builder');
  const line = (await r.state()).messages.at(-1);
  assert.equal(line.from, 'system');
  assert.equal(line.text, 'codex-1 is now builder');
  assert.deepEqual(line.to, []);
  assert.match((await call('GET', codex.link)).text, /^You are codex-1 \(role builder\)/);
  const history = (await r.human('api/history')).json;
  assert.equal(history.agents.find((a) => a.handle === 'codex-1').role, 'builder');

  const sent = await r.post(lead, '@builder go');
  assert.deepEqual((await r.state()).messages.find((m) => m.id === sent.json.id).to, ['codex-1']);
  const stale = await r.post(lead, '@tester go');
  assert.equal(stale.status, 400);
  assert.equal(stale.json.error, 'unknown_mention');
  assert.ok(stale.json.valid.includes('@builder'));

  const before = (await r.state()).messages.length;
  assert.equal((await call('POST', `${codex.link}/role`, { role: 'builder' })).status, 200);
  assert.equal((await r.state()).messages.length, before);

  assert.equal((await call('POST', `${codex.link}/role`, { role: null })).json.role, null);
  assert.equal((await r.state()).messages.at(-1).text, 'codex-1 has no role now');
  assert.equal((await r.post(lead, '@builder go')).status, 400);
});

test('a bad or missing role is refused and changes nothing', async () => {
  const r = await room();
  const a = await r.join({ harness: 'codex', role: 'tester' });
  for (const role of ['Bad Role', 'all', 'you', 'system', 'headless', 'x'.repeat(21), 5]) {
    const res = await call('POST', `${a.link}/role`, { role });
    assert.equal(res.status, 400, String(role));
    assert.equal(res.json.error, 'invalid_role');
  }
  assert.equal((await call('POST', `${a.link}/role`, {})).json.error, 'role_required');
  assert.equal((await r.roster('codex-1')).role, 'tester');
});

test('@you sets any agent role from the page; the line mentions and wakes it', async () => {
  const r = await room();
  const lead = await r.join({ harness: 'claude', lead: r.created.lead });
  const codex = await r.join({ harness: 'codex' });
  const child = (await call('POST', `${codex.link}/spawn`, { role: 'helper' })).json;

  const res = await r.human('api/agents/codex-1/role', { role: 'reviewer' });
  assert.equal(res.status, 200);
  assert.equal(res.json.role, 'reviewer');
  const line = (await r.state()).messages.at(-1);
  assert.equal(line.text, '@codex-1 is now reviewer, set by you');
  assert.deepEqual(line.to, ['codex-1']);
  assert.ok((await call('GET', `${codex.link}/read`)).json.messages.some((m) => m.id === line.id));

  assert.equal((await r.human(`api/agents/${child.handle}/role`, { role: 'fixtures' })).json.role, 'fixtures');
  const sent = await r.post(lead, '@reviewer @fixtures look');
  assert.deepEqual((await r.state()).messages.find((m) => m.id === sent.json.id).to.sort(), ['codex-1', child.handle].sort());

  assert.equal((await r.human('api/agents/nobody-1/role', { role: 'x' })).json.error, 'unknown_agent');
  assert.equal((await r.human('api/agents/codex-1/role', { role: 'Bad' })).json.error, 'invalid_role');
  await call('POST', `${codex.link}/leave`);
  assert.equal((await r.human('api/agents/codex-1/role', { role: 'x' })).status, 404);
});

test('@lead reaches the lead whatever role it holds', async () => {
  const r = await room();
  const lead = await r.join({ harness: 'claude', lead: r.created.lead, role: 'architect' });
  assert.equal(lead.role, 'architect');
  const codex = await r.join({ harness: 'codex', role: 'builder' });
  const seen = await r.roster('claude-1');
  assert.equal(seen.lead, true);
  assert.equal(seen.role, 'architect');

  const sent = await r.post(codex, '@lead done with #1');
  assert.equal(sent.status, 200);
  assert.deepEqual((await r.state()).messages.find((m) => m.id === sent.json.id).to, ['claude-1']);

  await call('POST', `${lead.link}/role`, { role: 'reviewer' });
  const again = await r.post(codex, '@lead and @reviewer');
  assert.deepEqual((await r.state()).messages.find((m) => m.id === again.json.id).to, ['claude-1']);
  const bad = await r.post(codex, '@nobody');
  assert.ok(bad.json.valid.includes('@lead'));
});
