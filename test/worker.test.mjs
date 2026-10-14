import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile, spawn } from 'node:child_process';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const FAKE = new URL('./fixtures/fake-acp.mjs', import.meta.url).pathname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-worker-'));
const promptLog = path.join(home, 'prompts.json');
let env;
let worker;
let out = '';

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function cli(...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function until(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(50);
  }
  assert.fail('timed out');
}

after(async () => {
  worker?.kill();
  if (env) await cli('down');
  fs.rmSync(home, { recursive: true, force: true });
});

test('a headless codex answers mentions in the same session', async () => {
  env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
  const created = JSON.parse((await cli('new', 'worker room')).stdout);
  const claude = await (await fetch(`${created.join}/join`, json({ harness: 'claude' }))).json();
  const other = await (await fetch(`${created.join}/join`, json({ harness: 'gemini' }))).json();

  worker = spawn(process.execPath, [CLI, 'worker', 'codex', created.join, '--dir', home], {
    env: {
      ...env,
      AGENT_HUDDLE_ACP_CMD: JSON.stringify([process.execPath, FAKE]),
      AGENT_HUDDLE_BATCH_MS: '200',
      FAKE_ACP: '1',
      FAKE_ACP_LOG: promptLog,
    },
  });
  worker.stdout.on('data', (d) => (out += d));
  await until(() => out.includes('codex-1 is listening'));
  assert.match(out, new RegExp(`in ${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(session fake-1\\)`));

  const who = await (await fetch(`${claude.link}/who`)).json();
  const roster = who.agents.find((a) => a.handle === 'codex-1');
  assert.equal(roster.role, 'headless');

  const replies = async () => (await (await fetch(`${claude.link}/read?limit=500`)).json()).messages.filter((m) => m.from === 'codex-1');
  const seen = [];
  const collect = async () => {
    seen.push(...(await replies()));
    return seen;
  };

  await fetch(`${claude.link}/post`, json({ text: '@codex-1 what is 2+2?' }));
  const first = await until(async () => (await collect())[0]);
  assert.match(first.text, /^echo\(fake-1\): .*@codex-1 what is 2\+2\?/);

  await fetch(`${other.link}/post`, json({ text: `@${claude.handle} unrelated chatter` }));
  await sleep(1000);
  assert.equal((await collect()).length, 1);

  await fetch(`${claude.link}/post`, json({ text: '@codex-1 and again' }));
  const second = await until(async () => (await collect())[1]);
  assert.match(second.text, /^echo\(fake-1\): /);

  const prompts = JSON.parse(fs.readFileSync(promptLog, 'utf8'));
  assert.equal(prompts.length, 2);
  assert.deepEqual(prompts.map((p) => p.sessionId), ['fake-1', 'fake-1']);
  assert.match(prompts[0].text, /headless Codex/);
  assert.doesNotMatch(prompts[1].text, /headless Codex/);
  assert.match(prompts[1].text, /→ you \[claude-1\] @codex-1 and again/);
});
