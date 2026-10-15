import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { workerProblem } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const FAKE = new URL('./fixtures/fake-acp.mjs', import.meta.url).pathname;
const servers = [];

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function cli(env, ...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(50);
  }
  assert.fail('timed out');
}

// A server of its own per test, so its env (the fake agent and its failure modes) reaches the workers it starts.
async function room(extra = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-start-'));
  const env = {
    ...process.env,
    AGENT_HUDDLE_HOME: home,
    AGENT_HUDDLE_PORT: String(await freePort()),
    AGENT_HUDDLE_ACP_CMD: JSON.stringify([process.execPath, FAKE]),
    AGENT_HUDDLE_BATCH_MS: '100',
    FAKE_ACP: '1',
    FAKE_ACP_PID: path.join(home, 'agent.pid'),
    ...extra,
  };
  servers.push({ env, home });
  const created = JSON.parse((await cli(env, 'new', 'start room', '--dir', home)).stdout);
  const page = created.page;
  const get = async () => (await fetch(`${page}/api/state`)).json();
  return { env, home, created, page, get, start: (body) => fetch(`${page}/api/workers`, json(body)) };
}

after(async () => {
  for (const { env, home } of servers) {
    await cli(env, 'down');
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-37.1-3: the page starts a headless worker in the room folder that joins as headless and logs to an owner-only file', async () => {
  const r = await room();
  const res = await r.start({ harness: 'codex' });
  assert.equal(res.status, 201);
  const w = await res.json();
  assert.equal(w.status, 'running');
  assert.equal(w.handle, 'codex-1');
  assert.equal(w.folder, r.home);
  assert.equal(path.dirname(w.log), path.join(r.home, 'workers'));
  assert.equal(fs.statSync(w.log).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(w.log)).mode & 0o777, 0o700);
  assert.match(fs.readFileSync(w.log, 'utf8'), /codex-1 is listening in /);

  const state = await r.get();
  assert.deepEqual(state.workers.map((x) => [x.id, x.handle, x.status, x.log]), [[w.id, 'codex-1', 'running', w.log]]);
  const agent = state.agents.find((a) => a.handle === 'codex-1');
  assert.equal(agent.headless, true);
  assert.equal(agent.role, null);
  assert.equal(agent.harness, 'codex');

  const claude = await (await fetch(`${r.created.join}/join`, json({ harness: 'claude' }))).json();
  await fetch(`${claude.link}/post`, json({ text: '@codex-1 hello' }));
  await until(async () => (await r.get()).messages.some((m) => m.from === 'codex-1' && m.text.includes('hello')));
});

test('the page starts a worker with the role from Add agent and rejects a bad one before spawning', async () => {
  const r = await room();
  const bad = await r.start({ harness: 'codex', role: 'Not A Role' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'invalid_role');
  assert.equal((await r.get()).workers.length, 0);

  const res = await r.start({ harness: 'codex', role: 'builder' });
  assert.equal(res.status, 201);
  const { handle } = await res.json();
  const agent = (await r.get()).agents.find((a) => a.handle === handle);
  assert.equal(agent.role, 'builder');
  assert.equal(agent.headless, true);
});

test('AC-37.4: the page stops a worker it started; it leaves and shows as stopped', async () => {
  const r = await room();
  const w = await (await r.start({ harness: 'gemini' })).json();
  const pid = Number(fs.readFileSync(path.join(r.home, 'agent.pid'), 'utf8'));
  assert.equal((await fetch(`${r.page}/api/workers/9/stop`, json({}))).status, 404);
  const stop = await fetch(`${r.page}/api/workers/${w.id}/stop`, json({}));
  assert.equal(stop.status, 200);
  assert.equal((await stop.json()).status, 'stopping');
  await until(async () => (await r.get()).workers[0].status === 'stopped');
  const state = await r.get();
  assert.equal(state.agents.find((a) => a.handle === 'gemini-1').status, 'left');
  assert.equal(alive(pid), false);
  assert.match(fs.readFileSync(w.log, 'utf8'), /worker stopped/);
});

test('AC-37.4: ending the room stops the workers it started', async () => {
  const r = await room();
  await r.start({ harness: 'opencode' });
  const pid = Number(fs.readFileSync(path.join(r.home, 'agent.pid'), 'utf8'));
  const ended = await cli(r.env, 'end', 'start room', '--yes');
  assert.equal(ended.code, 0, ended.stderr);
  await until(() => !alive(pid));
});

test('AC-37.4: down stops the workers the server started', async () => {
  const r = await room();
  await r.start({ harness: 'claude' });
  const pid = Number(fs.readFileSync(path.join(r.home, 'agent.pid'), 'utf8'));
  const down = await cli(r.env, 'down');
  assert.equal(down.code, 0, down.stderr);
  await until(() => !alive(pid));
});

test('AC-37.1: only the page link starts a worker', async () => {
  const r = await room();
  const claude = await (await fetch(`${r.created.join}/join`, json({ harness: 'claude' }))).json();
  assert.equal((await fetch(`${claude.link}/api/workers`, json({ harness: 'codex' }))).status, 404);
  assert.equal((await fetch(`${r.created.join}/h/wrong/api/workers`, json({ harness: 'codex' }))).status, 401);
  const dsh = await r.start({ harness: 'dsh' });
  assert.equal(dsh.status, 400);
  assert.equal((await dsh.json()).error, 'unknown_worker_harness');
  assert.equal((await r.start({ harness: 'codex', folder: path.join(r.home, 'missing') })).status, 400);
  const state = await r.get();
  assert.deepEqual(state.workers, []);
  assert.equal(state.agents.some((a) => a.harness === 'codex'), false);
});

test('AC-37.5: a missing agent binary answers 424 naming it and starts nothing', async () => {
  const r = await room({ AGENT_HUDDLE_ACP_CMD: JSON.stringify(['/nonexistent/codex-acp']) });
  const res = await r.start({ harness: 'codex' });
  assert.equal(res.status, 424);
  const body = await res.json();
  assert.equal(body.error, 'worker_unavailable');
  assert.match(body.message, /^Codex cannot start here: \/nonexistent\/codex-acp is not installed or not on your PATH/);
  assert.deepEqual((await r.get()).workers, []);
});

test('AC-37.5: a worker that fails to start answers 502 with its own error and the log path', async () => {
  const r = await room({ FAKE_ACP_NEW_FAIL: '1' });
  const res = await r.start({ harness: 'claude' });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, 'worker_failed');
  assert.match(body.message, /^Claude Code stopped while starting: could not start the agent: auth required; if Claude Code is not signed in, run claude in a terminal and sign in with \/login, then start the worker again\.$/);
  const [w] = (await r.get()).workers;
  assert.equal(w.status, 'failed');
  assert.ok(body.instruction.includes(w.log));
  assert.match(fs.readFileSync(w.log, 'utf8'), /auth required/);
});

test('AC-37.5: doctor-style detection names bunx for Claude Code and Codex and the binary for the others', () => {
  const saved = { PATH: process.env.PATH, cmd: process.env.AGENT_HUDDLE_ACP_CMD, apps: process.env.AGENT_HUDDLE_APP_DIRS };
  process.env.PATH = '';
  process.env.AGENT_HUDDLE_APP_DIRS = '';
  delete process.env.AGENT_HUDDLE_ACP_CMD;
  try {
    assert.equal(workerProblem('claude'), 'bunx is not on your PATH, and headless Claude Code starts its ACP adapter with it (install Bun)');
    assert.match(workerProblem('codex'), /^bunx is not on your PATH, and headless Codex/);
    assert.equal(workerProblem('gemini'), 'gemini is not installed or not on your PATH (install Gemini CLI and sign in)');
    assert.match(workerProblem('opencode'), /^opencode is not installed/);
    process.env.PATH = path.dirname(process.execPath);
    process.env.AGENT_HUDDLE_ACP_CMD = JSON.stringify(['node', FAKE]);
    assert.equal(workerProblem('opencode'), null);
  } finally {
    process.env.PATH = saved.PATH;
    for (const [k, v] of [['AGENT_HUDDLE_ACP_CMD', saved.cmd], ['AGENT_HUDDLE_APP_DIRS', saved.apps]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
