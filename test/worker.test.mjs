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
const pidFile = path.join(home, 'agent.pid');
let env;
const workers = [];

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

const readPrompts = () => (fs.existsSync(promptLog) ? JSON.parse(fs.readFileSync(promptLog, 'utf8')) : { prompts: [] });

async function setup(name) {
  env ??= { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
  fs.rmSync(promptLog, { force: true });
  const created = JSON.parse((await cli('new', name)).stdout);
  const claude = await (await fetch(`${created.join}/join`, json({ harness: 'claude' }))).json();
  return { created, claude };
}

function startWorker(join, extra = {}) {
  const proc = spawn(process.execPath, [CLI, 'worker', 'codex', join, '--dir', home], {
    env: {
      ...env,
      AGENT_HUDDLE_ACP_CMD: JSON.stringify([process.execPath, FAKE]),
      AGENT_HUDDLE_BATCH_MS: '100',
      FAKE_ACP: '1',
      FAKE_ACP_LOG: promptLog,
      FAKE_ACP_PID: pidFile,
      ...extra,
    },
  });
  const w = { proc, out: '', err: '', exit: new Promise((resolve) => proc.on('exit', (code) => resolve(code))) };
  proc.stdout.on('data', (d) => (w.out += d));
  proc.stderr.on('data', (d) => (w.err += d));
  workers.push(proc);
  return w;
}

const say = (agent, text) => fetch(`${agent.link}/post`, json({ text }));
const codexPosts = async (room) => (await (await fetch(`${room.created.page}/api/state`)).json()).messages.filter((m) => m.from === 'codex-1');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

after(async () => {
  workers.forEach((w) => w.kill('SIGKILL'));
  if (env) await cli('down');
  fs.rmSync(home, { recursive: true, force: true });
});

test('a headless codex answers mentions in the same session', async () => {
  const { created, claude } = await setup('worker room');
  const other = await (await fetch(`${created.join}/join`, json({ harness: 'gemini' }))).json();

  const w = startWorker(created.join, { AGENT_HUDDLE_BATCH_MS: '200' });
  await until(() => w.out.includes('codex-1 is listening'));
  assert.match(w.out, new RegExp(`in ${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(session fake-1\\)`));

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

  const { prompts } = readPrompts();
  assert.equal(prompts.length, 2);
  assert.deepEqual(prompts.map((p) => p.sessionId), ['fake-1', 'fake-1']);
  assert.match(prompts[0].text, /headless Codex/);
  assert.doesNotMatch(prompts[1].text, /headless Codex/);
  assert.match(prompts[1].text, /→ you \[claude-1\] @codex-1 and again/);
});

test('a mention during a run is queued for the next run, never overlapping', async () => {
  const room = await setup('queue room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '800' });
  await until(() => w.out.includes('codex-1 is listening'));

  await say(room.claude, '@codex-1 first question');
  await until(() => readPrompts().prompts.length === 1);
  await say(room.claude, '@codex-1 second question');
  await until(async () => (await codexPosts(room)).length === 2, 8000);

  const { prompts, maxConcurrency } = readPrompts();
  assert.equal(prompts.length, 2);
  assert.equal(maxConcurrency, 1);
  assert.match(prompts[1].text, /second question/);
  assert.doesNotMatch(prompts[1].text, /first question/);
});

test('a run past the timeout is cancelled, announced to @you, and the worker keeps listening', async () => {
  const room = await setup('timeout room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_RUN_MS: '300', FAKE_ACP_DELAY_MS: '5000' });
  await until(() => w.out.includes('codex-1 is listening'));

  await say(room.claude, '@codex-1 take your time');
  const stop = await until(async () => (await codexPosts(room)).find((m) => m.text.includes('Run stopped')));
  assert.match(stop.text, /^@you Run stopped after 0\.3 s$/);
  assert.equal(w.proc.exitCode, null);

  await say(room.claude, '@codex-1 once more');
  await until(async () => (await codexPosts(room)).filter((m) => m.text.includes('Run stopped')).length === 2);
  assert.equal(readPrompts().prompts.length, 2);
});

test('an agent that ignores the cancel is killed and the worker exits 1', async () => {
  const room = await setup('hang room');
  const w = startWorker(room.created.join, {
    AGENT_HUDDLE_RUN_MS: '200',
    AGENT_HUDDLE_CANCEL_MS: '300',
    FAKE_ACP_DELAY_MS: '5000',
    FAKE_ACP_HANG: '1',
  });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 hang');
  assert.equal(await w.exit, 1);
  assert.match(w.err, /did not stop after cancel/);
  assert.equal(alive(Number(fs.readFileSync(pidFile, 'utf8'))), false);
});

for (const [mode, reason] of [['meta-fail', 'boom'], ['refusal', 'refused']]) {
  test(`a ${mode} run is reported to @you and the worker keeps listening`, async () => {
    const room = await setup(`${mode} room`);
    const w = startWorker(room.created.join, { FAKE_ACP_STOP: mode });
    await until(() => w.out.includes('codex-1 is listening'));

    await say(room.claude, '@codex-1 do the thing');
    const failed = await until(async () => (await codexPosts(room))[0]);
    assert.match(failed.text, new RegExp(`^@you codex-1 run failed: .*${reason}`));
    assert.equal(w.proc.exitCode, null);
  });
}

test('a failed start prints the cause, exits 1 and leaves the room', async () => {
  const room = await setup('start-fail room');
  const w = startWorker(room.created.join, { FAKE_ACP_NEW_FAIL: '1' });
  assert.equal(await w.exit, 1);
  assert.match(w.err, /could not start the agent: auth required/);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
});

test('SIGTERM during a run cancels it, leaves the room and kills the agent', async () => {
  const room = await setup('stop room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '5000' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 long job');
  await until(() => w.out.includes('running on'));
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));

  w.proc.kill('SIGTERM');
  assert.equal(await w.exit, 0);
  assert.equal(alive(pid), false);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
  assert.equal((await codexPosts(room)).length, 0);
});
