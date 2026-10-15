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
