import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function call(method, url, body) {
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return res.json();
}

async function room() {
  const huddle = createHuddle({ adminToken: 'admin' });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = await call('POST', `http://127.0.0.1:${port}/new`, { name: 'steward' });
  const join = (body) => call('POST', `${created.join}/join`, body);
  return { created, join };
}

test('AC-49: the agent that joins with the lead key is the lead, once', async () => {
  const { created, join } = await room();
  assert.equal(typeof created.lead, 'string');

  const codex = await join({ harness: 'codex', lead: created.lead });
  assert.equal(codex.lead, 'codex-1');
  assert.equal(codex.role, 'lead');

  const claude = await join({ harness: 'claude', role: 'lead' });
  assert.equal(claude.role, 'lead');
  assert.equal(claude.lead, 'codex-1');

  const opencode = await join({ harness: 'opencode', lead: created.lead });
  assert.equal(opencode.lead, 'codex-1');
  assert.equal(opencode.role, null);

  const leads = (agents) => agents.filter((a) => a.lead).map((a) => a.handle);
  assert.deepEqual(leads((await call('GET', `${codex.link}/who`)).agents), ['codex-1']);
  assert.deepEqual(leads((await call('GET', `${created.page}/api/state`)).agents), ['codex-1']);
  assert.equal((await call('GET', `${claude.link}/me`)).lead, 'codex-1');
});

test('a wrong lead key is ignored and the join still works', async () => {
  const { created, join } = await room();
  const wrong = await join({ harness: 'codex', lead: 'nope' });
  assert.equal(wrong.handle, 'codex-1');
  assert.equal(wrong.lead, null);
  assert.equal(wrong.role, null);
  assert.equal((await join({ harness: 'claude', lead: created.lead })).lead, 'claude-1');
});
