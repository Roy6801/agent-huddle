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
const grandchildFile = path.join(home, 'grandchild.pid');
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

const readPrompts = () => (fs.existsSync(promptLog) ? JSON.parse(fs.readFileSync(promptLog, 'utf8')) : { prompts: [], cancels: [] });

async function setup(name, ...newArgs) {
  env ??= { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()), AGENT_HUDDLE_QUIET_MS: '1500', AGENT_HUDDLE_ASK_MS: '3000' };
  fs.rmSync(promptLog, { force: true });
  const created = JSON.parse((await cli('new', name, ...newArgs)).stdout);
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
const state = async (room) => (await (await fetch(`${room.created.page}/api/state`)).json()).messages;
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

test('SIGTERM during a run cancels it, leaves the room and reaps the agent process tree', async () => {
  const room = await setup('stop room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '5000', FAKE_ACP_GRANDCHILD: grandchildFile });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 long job');
  await until(() => w.out.includes('running on'));
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  const grandchild = Number(fs.readFileSync(grandchildFile, 'utf8'));
  assert.ok(alive(grandchild));

  w.proc.kill('SIGTERM');
  assert.equal(await w.exit, 0);
  assert.equal(alive(pid), false);
  assert.equal(alive(grandchild), false);
  assert.deepEqual(readPrompts().cancels, ['fake-1']);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
  assert.equal((await codexPosts(room)).length, 0);
});

test('a missing agent binary exits 1 naming it and leaves the room', async () => {
  const room = await setup('missing room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_ACP_CMD: JSON.stringify(['/nonexistent/codex-acp']) });
  assert.equal(await w.exit, 1);
  assert.match(w.err, /\/nonexistent\/codex-acp/);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
});

test('a bad AGENT_HUDDLE_ACP_CMD is rejected before joining', async () => {
  const room = await setup('bad cmd room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_ACP_CMD: 'not json' });
  assert.equal(await w.exit, 1);
  assert.match(w.err, /AGENT_HUDDLE_ACP_CMD must be a JSON array/);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.some((a) => a.handle === 'codex-1'), false);
});

test('at the round cap the reply is not retried and the worker keeps listening', async () => {
  const room = await setup('cap room', '--round-cap', '3');
  const w = startWorker(room.created.join);
  await until(() => w.out.includes('codex-1 is listening'));

  await say(room.claude, '@codex-1 one');
  await until(async () => (await codexPosts(room)).length === 1);
  await say(room.claude, '@codex-1 two');
  await until(() => w.out.includes('round cap reached'));
  await sleep(500);

  assert.equal(w.out.split('round cap reached').length - 1, 1);
  assert.equal((await codexPosts(room)).length, 1);
  assert.equal(readPrompts().prompts.length, 2);
  assert.equal(w.proc.exitCode, null);
});

test('a room ended mid-run cancels the run and exits 0 promptly', async () => {
  const room = await setup('end room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '15000', AGENT_HUDDLE_HEARTBEAT_MS: '200' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 long job');
  await until(() => w.out.includes('running on'));

  const started = Date.now();
  assert.equal((await cli('end', 'end room', '--yes', '--keep-server')).code, 0);
  assert.equal(await w.exit, 0);
  assert.ok(Date.now() - started < 5000);
  assert.match(w.out, /room ended/);
  assert.deepEqual(readPrompts().cancels, ['fake-1']);
});

test('a busy worker keeps its heartbeat so a mention mid-run is not reported as not listening', async () => {
  const room = await setup('busy room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '4000', AGENT_HUDDLE_HEARTBEAT_MS: '300' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 long job');
  await until(() => w.out.includes('running on'));
  await sleep(2200);

  await say(room.claude, '@codex-1 are you there?');
  await sleep(500);
  assert.equal((await state(room)).some((m) => /isn't listening/.test(m.text)), false);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'active');

  w.proc.kill('SIGTERM');
  await w.exit;
});

test('a reply the server rejects is reported to @you once', async () => {
  const room = await setup('reject room');
  const w = startWorker(room.created.join, { FAKE_ACP_REPLY: '@nobody hello' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 hi');
  await until(async () => (await codexPosts(room)).length === 1);
  await sleep(500);

  const posts = await codexPosts(room);
  assert.equal(posts.length, 1);
  assert.match(posts[0].text, /^@you codex-1 reply could not be posted: unknown mention nobody/);
});

test('a reply over the server limit is truncated with a marker', async () => {
  const room = await setup('long room');
  const w = startWorker(room.created.join, { FAKE_ACP_REPLY: 'x'.repeat(9000) });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 write a lot');
  const [post] = await until(async () => {
    const posts = await codexPosts(room);
    return posts.length ? posts : null;
  });
  assert.equal(post.text.length, 8000);
  assert.ok(post.text.endsWith('… (truncated)'));
});

const asks = async (room) => (await (await fetch(`${room.created.page}/api/state`)).json()).asks;
const answerAsk = (room, n, optionId) => fetch(`${room.created.page}/api/asks/${n}`, json({ optionId }));

test('a permission request waits for the human and passes the chosen option to the agent', async () => {
  const room = await setup('perm room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: '1' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 write it');
  const [ask] = await until(async () => (await asks(room)).length && asks(room));
  assert.equal(ask.title, 'Write ../outside.txt');
  assert.deepEqual(ask.options.map((o) => [o.optionId, o.name]), [['allow_once', 'Allow once'], ['allow_for_session', 'Always'], ['decline', 'Deny']]);
  assert.deepEqual(readPrompts().outcomes, []);
  assert.equal((await answerAsk(room, 1, 'allow_for_session')).status, 200);
  await until(() => readPrompts().outcomes?.length);
  assert.deepEqual(readPrompts().outcomes, [{ outcome: 'selected', optionId: 'allow_for_session' }]);
  await until(async () => (await codexPosts(room)).some((m) => m.text.includes('[allow_for_session]')));
  assert.match(w.out, /chose allow_for_session/);
});

test('an unanswered permission request times out and the agent is declined', async () => {
  const room = await setup('perm timeout room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: '1' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 write it');
  await until(() => readPrompts().outcomes?.length, 15000);
  assert.deepEqual(readPrompts().outcomes, [{ outcome: 'selected', optionId: 'decline' }]);
  assert.equal((await asks(room))[0].status, 'timeout');
  await until(async () => (await codexPosts(room)).some((m) => m.text.includes('[decline]')));
});

test('SIGTERM while a permission request is open cancels the ask and exits 0', async () => {
  const room = await setup('perm stop room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: '1' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 write it');
  await until(async () => (await asks(room)).length);
  w.proc.kill('SIGTERM');
  assert.equal(await w.exit, 0);
  assert.equal((await asks(room))[0].status, 'cancelled');
  assert.equal((await codexPosts(room)).length, 0);
  await until(() => readPrompts().outcomes?.length);
  assert.deepEqual(readPrompts().outcomes, [{ outcome: 'cancelled' }]);
});

test('the run clock stops while a permission request is open', async () => {
  const room = await setup('perm clock room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: '1', AGENT_HUDDLE_RUN_MS: '400' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 write it');
  await until(async () => (await asks(room)).length);
  await sleep(1200);
  assert.equal((await asks(room))[0].status, 'open');
  assert.deepEqual(readPrompts().cancels ?? [], []);
  assert.equal((await answerAsk(room, 1, 'allow_once')).status, 200);
  await until(async () => (await codexPosts(room)).some((m) => m.text.includes('[allow_once]')));
  assert.equal((await codexPosts(room)).some((m) => m.text.includes('Run stopped')), false);
  assert.equal(w.proc.exitCode, null);
});

test('a room ended while a permission request is open cancels it and exits 0', async () => {
  const room = await setup('perm end room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: '1', AGENT_HUDDLE_HEARTBEAT_MS: '200' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 write it');
  await until(async () => (await asks(room)).length);
  assert.equal((await cli('end', 'perm end room', '--yes', '--keep-server')).code, 0);
  assert.equal(await w.exit, 0);
  assert.deepEqual(readPrompts().outcomes, [{ outcome: 'cancelled' }]);
});
