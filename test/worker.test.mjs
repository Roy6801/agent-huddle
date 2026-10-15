import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { WORKER_HARNESSES } from '../skills/agent-huddle/huddle.mjs';

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

function startWorker(join, extra = {}, harness = 'codex', args = []) {
  const proc = spawn(process.execPath, [CLI, 'worker', harness, join, '--dir', home, ...args], {
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
  assert.equal(roster.headless, true);
  assert.equal(roster.role, null);
  assert.equal(roster.folder, home);

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

test('a headless assignee sees the task description and spec in its prompt', async () => {
  const { created, claude } = await setup('task room');
  const w = startWorker(created.join);
  await until(() => w.out.includes('codex-1 is listening'));

  const description = 'Write README.md for wordfreq; done when the usage example runs';
  const spec = '## README\n- usage: wordfreq <file> [--top N]\n- ties sort alphabetically';
  await fetch(`${claude.link}/tasks`, json({ title: 'Write README', assignee: 'codex-1', description, spec }));
  const prompt = await until(() => readPrompts().prompts[0]);
  assert.match(prompt.text, /→ you \[system\] claude-1 created task #1 "Write README" for @codex-1/);
  assert.ok(prompt.text.includes(description));
  assert.ok(prompt.text.includes(spec));

  const fileSpec = '# tests\n- one fixture per tie case';
  const up = await (await fetch(`${claude.link}/files?name=spec-tests.md`, { method: 'POST', headers: { 'content-type': 'text/markdown' }, body: fileSpec })).json();
  await fetch(`${claude.link}/tasks`, json({ title: 'Write tests', assignee: 'codex-1', specFile: up.id }));
  const second = await until(() => readPrompts().prompts[1]);
  assert.ok(second.text.includes('Spec (room file spec-tests.md):'));
  assert.ok(second.text.includes(fileSpec));
});

const calls = (...list) => ({ FAKE_ACP_CALLS: JSON.stringify(list) });

test('a headless agent gets the room commands of a terminal agent, minus the calls its worker makes', async () => {
  const room = await setup('commands room');
  const w = startWorker(room.created.join);
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 go');
  const { text } = await until(() => readPrompts().prompts[0]);
  assert.match(text, /Your personal link \(keep it, it is your identity\): http:\/\/127\.0\.0\.1:\d+\/s\/[^/]+\/as\/\S+/);
  for (const cmd of ['Post:', 'List tasks:', 'Read task:', 'Claim task:', 'Finish task:', 'Release task:', 'Reopen task:', 'Upload file:', 'Attach files:']) {
    assert.ok(text.includes(`  ${cmd}`), cmd);
  }
  for (const cmd of ['Read new:', 'Wait (<=25s):', 'Wait (long):', 'Spawn child:', 'Leave:']) assert.ok(!text.includes(`  ${cmd}`), cmd);
  assert.match(text, /never say you claimed, finished or posted something the room refused/);
  assert.match(text, /asking for network access, which @you approves on the room page/);
  assert.doesNotMatch(text, /cannot reach the huddle/);

  const terminal = await (await fetch(room.claude.link)).text();
  assert.ok(terminal.includes('  Wait (<=25s):') && terminal.includes('  Leave:'));
});

test('a headless assignee claims its task, then finishes it with a note that wakes the creator', async () => {
  const room = await setup('claim room');
  const w = startWorker(room.created.join, calls(['POST', 'tasks/1/claim'], ['POST', 'tasks/1/done', { note: 'added --top N; 3 tests pass' }]));
  await until(() => w.out.includes('codex-1 is listening'));
  await fetch(`${room.claude.link}/tasks`, json({ title: 'Add a --top N flag', assignee: 'codex-1', description: 'print the N most frequent words' }));
  const [reply] = await until(async () => {
    const posts = await codexPosts(room);
    return posts.length ? posts : null;
  });

  assert.deepEqual(readPrompts().calls.map((c) => c.status), [200, 200]);
  const task = await (await fetch(`${room.claude.link}/tasks/1`)).json();
  assert.equal(task.status, 'done');
  assert.equal(task.owner, 'codex-1');
  assert.equal(task.note, 'added --top N; 3 tests pass');
  const messages = await state(room);
  const claimed = messages.find((m) => m.text === 'codex-1 claimed task #1');
  assert.ok(claimed && claimed.id < reply.id);
  const { messages: forClaude } = await (await fetch(`${room.claude.link}/read?limit=500`)).json();
  assert.ok(forClaude.some((m) => m.to?.includes('claude-1') && m.text === 'Task #1 "Add a --top N flag" is done by codex-1: added --top N; 3 tests pass'));
});

test('a refused claim reaches the agent as the structured error, and the task stays unclaimed', async () => {
  const room = await setup('refused room');
  const w = startWorker(room.created.join, calls(['POST', 'tasks/2/claim']));
  await until(() => w.out.includes('codex-1 is listening'));
  await fetch(`${room.claude.link}/tasks`, json({ title: 'Add a --top N flag', assignee: 'claude-1' }));
  await fetch(`${room.claude.link}/tasks`, json({ title: 'Add tests for --top', assignee: 'codex-1', after: [1] }));
  await say(room.claude, '@codex-1 take #2');
  const [reply] = await until(async () => {
    const posts = await codexPosts(room);
    return posts.length ? posts : null;
  });

  const [call] = readPrompts().calls;
  assert.equal(call.status, 409);
  assert.equal(call.body.error, 'task_blocked');
  assert.equal(call.body.message, 'Task #2 is blocked by #1.');
  assert.match(call.body.instruction, /^Wait until those tasks are done/);
  assert.match(reply.text, /tasks\/2\/claim: Task #2 is blocked by #1\./);
  const task = await (await fetch(`${room.claude.link}/tasks/2`)).json();
  assert.equal(task.status, 'open');
  assert.equal(task.owner, null);
});

test('an off-shift wake runs no turn; the next mention does', async () => {
  const room = await setup('off shift room');
  const w = startWorker(room.created.join);
  await until(() => w.out.includes('codex-1 is listening'));

  await fetch(`${room.claude.link}/tasks`, json({ title: 'only task' }));
  await fetch(`${room.claude.link}/tasks/1/done`, json({ note: 'done' }));
  await until(async () => (await state(room)).some((m) => m.offShift && m.to.includes('codex-1')));
  await sleep(1000);
  assert.equal(readPrompts().prompts.length, 0);
  assert.doesNotMatch(w.out, /running on/);

  await say(room.claude, '@codex-1 one more thing');
  const prompt = await until(() => readPrompts().prompts[0]);
  const batch = prompt.text.split('Room messages:\n').at(-1);
  assert.match(batch, /one more thing/);
  assert.doesNotMatch(batch, /off shift/);
});

test('a wake whose batch ends off shift with only system notes for it runs no turn', async () => {
  const room = await setup('off shift batch room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_BATCH_MS: '500' });
  await until(() => w.out.includes('codex-1 is listening'));

  await fetch(`${room.claude.link}/tasks`, json({ title: 'only task', assignee: 'codex-1' }));
  await fetch(`${room.claude.link}/tasks/1/done`, json({ note: 'done for you' }));
  await until(async () => (await state(room)).some((m) => m.offShift && m.to.includes('codex-1')));
  await sleep(1000);
  assert.equal(readPrompts().prompts.length, 0);
  assert.doesNotMatch(w.out, /running on/);

  await say(room.claude, '@codex-1 one more thing');
  const prompt = await until(() => readPrompts().prompts[0]);
  assert.match(prompt.text, /one more thing/);
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
  assert.doesNotMatch(w.err, /sign in/);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
});

test('a failed start of worker claude says to sign in with claude, never with an API key', async () => {
  const room = await setup('claude start-fail room');
  const w = startWorker(room.created.join, { FAKE_ACP_NEW_FAIL: '1' }, 'claude');
  assert.equal(await w.exit, 1);
  assert.match(w.err, /could not start the agent: auth required; if Claude Code is not signed in, run claude in a terminal and sign in with \/login/);
  assert.doesNotMatch(w.err, /API key/i);
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

test('at the round cap the reply is not retried, the worker keeps listening, and after @you posts its next reply goes through', async () => {
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

  await fetch(`${room.created.page}/api/post`, json({ text: 'carry on' }));
  const [, next] = await until(async () => {
    const posts = await codexPosts(room);
    return posts.length === 2 ? posts : null;
  });
  assert.match(next.text, /\[you\] carry on$/);
  assert.equal(w.out.split('round cap reached').length - 1, 1);
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
  assert.match(posts[0].text, /^@you codex-1 reply could not be posted: nobody is not anyone in this room/);
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

for (const [mode, how] of [['ids', 'by message id'], ['noids', 'by the tool call between them']]) {
  test(`separate agent messages post as one reply split into paragraphs (${how}), so a mention after a period counts`, async () => {
    const room = await setup(`split room ${mode}`);
    const w = startWorker(room.created.join, { FAKE_ACP_SPLIT: mode });
    await until(() => w.out.includes('codex-1 is listening'));
    await say(room.claude, '@codex-1 check it');
    const [post] = await until(async () => {
      const posts = await codexPosts(room);
      return posts.length ? posts : null;
    });
    assert.equal(post.text, 'I will look at it.\n\n@you it is done.');
    assert.equal(post.toYou, true);
  });
}

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

test('worker --role joins headless with that role, and @role wakes it', async () => {
  const room = await setup('headless role room');
  const w = startWorker(room.created.join, {}, 'codex', ['--role', 'builder']);
  await until(() => w.out.includes('codex-1 is listening'));
  const roster = (await (await fetch(`${room.claude.link}/who`)).json()).agents.find((a) => a.handle === 'codex-1');
  assert.equal(roster.role, 'builder');
  assert.equal(roster.headless, true);
  assert.ok((await state(room)).some((m) => m.text === 'codex-1 joined headless as builder'));

  await say(room.claude, '@builder ping');
  await until(() => readPrompts().prompts.length === 1);
  assert.match(readPrompts().prompts[0].text, /You are codex-1 \(role builder\)/);
  assert.doesNotMatch(readPrompts().prompts[0].text, /Wait \(<=25s\):/);
});

test('worker gemini sets the planned mode when the agent offers it, and joins as a headless gemini', async () => {
  const room = await setup('gemini planned mode room');
  const w = startWorker(room.created.join, { FAKE_ACP_MODES: 'autoEdit,default' }, 'gemini');
  await until(() => w.out.includes('gemini-1 is listening'));
  assert.match(w.out, /mode autoEdit/);
  assert.deepEqual(readPrompts().modes, [{ sessionId: 'fake-1', modeId: 'autoEdit' }]);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'gemini-1').headless, true);

  await say(room.claude, '@gemini-1 hi');
  await until(() => readPrompts().prompts.length === 1);
  assert.match(readPrompts().prompts[0].text, /\(headless Gemini CLI\)/);
});

test('worker claude joins headless in acceptEdits, answers a mention, and its adapter never sees an API key', async () => {
  const room = await setup('claude headless room');
  const w = startWorker(
    room.created.join,
    { FAKE_ACP_MODES: 'default,acceptEdits,plan,auto,bypassPermissions', ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_AUTH_TOKEN: 'tok-test' },
    'claude',
  );
  await until(() => w.out.includes('claude-2 is listening'));
  assert.match(w.out, /mode acceptEdits/);
  assert.deepEqual(readPrompts().modes, [{ sessionId: 'fake-1', modeId: 'acceptEdits' }]);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'claude-2').headless, true);
  assert.doesNotMatch(w.err, /hears the room from its own terminal/);

  await say(room.claude, '@claude-2 hi');
  await until(async () => (await state(room)).some((m) => m.from === 'claude-2' && m.text.includes('echo(fake-1)')));
  assert.match(readPrompts().prompts[0].text, /You are claude-2 \(headless Claude Code\)/);
  assert.deepEqual(readPrompts().env, { apiKey: false, authToken: false, opencodeConfig: null });
});

test('a Claude Code permission request becomes an Allow once / Always / Deny card with its command', async () => {
  const room = await setup('claude perm room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: 'claude' }, 'claude');
  await until(() => w.out.includes('claude-2 is listening'));
  await say(room.claude, '@claude-2 clean up');
  const [ask] = await until(async () => (await asks(room)).length && asks(room));
  assert.equal(ask.title, 'rm -rf build');
  assert.equal(ask.detail, 'command: rm -rf build');
  assert.deepEqual(ask.options.map((o) => [o.optionId, o.name]), [['allow-once', 'Allow once'], ['allow-with-updates', 'Always'], ['reject', 'Deny']]);
  assert.equal((await answerAsk(room, 1, 'allow-with-updates')).status, 200);
  await until(() => readPrompts().outcomes?.length);
  assert.deepEqual(readPrompts().outcomes, [{ outcome: 'selected', optionId: 'allow-with-updates' }]);
  await until(async () => (await state(room)).some((m) => m.from === 'claude-2' && m.text.includes('[allow-with-updates]')));
});

test('worker opencode joins headless, switches its mode to build, asks for shell commands, and answers a mention', async () => {
  const room = await setup('opencode headless room');
  const w = startWorker(room.created.join, { FAKE_ACP_CONFIG_MODES: 'plan,build' }, 'opencode');
  await until(() => w.out.includes('opencode-1 is listening'));
  assert.match(w.out, /mode build/);
  assert.deepEqual(readPrompts().modes, [{ sessionId: 'fake-1', configId: 'mode', value: 'build' }]);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'opencode-1').headless, true);
  assert.doesNotMatch(w.err, /hears the room from its own terminal/);

  await say(room.claude, '@opencode-1 hi');
  await until(async () => (await state(room)).some((m) => m.from === 'opencode-1' && m.text.includes('echo(fake-1)')));
  assert.match(readPrompts().prompts[0].text, /You are opencode-1 \(headless opencode\)/);
  assert.deepEqual(JSON.parse(readPrompts().env.opencodeConfig), { permission: { edit: 'allow', bash: 'ask' } });
});

test('an opencode permission request becomes an Allow once / Always / Deny card with its command', async () => {
  const room = await setup('opencode perm room');
  const w = startWorker(room.created.join, { FAKE_ACP_PERMISSION: 'opencode' }, 'opencode');
  await until(() => w.out.includes('opencode-1 is listening'));
  assert.doesNotMatch(w.out, /mode/);
  await say(room.claude, '@opencode-1 clean up');
  const [ask] = await until(async () => (await asks(room)).length && asks(room));
  assert.equal(ask.title, 'rm -rf build');
  assert.equal(ask.detail, 'command: rm -rf build');
  assert.deepEqual(ask.options.map((o) => [o.optionId, o.name]), [['once', 'Allow once'], ['always', 'Always'], ['reject', 'Deny']]);
  assert.equal((await answerAsk(room, 1, 'always')).status, 200);
  await until(() => readPrompts().outcomes?.length);
  assert.deepEqual(readPrompts().outcomes, [{ outcome: 'selected', optionId: 'always' }]);
});

test('a failed start of worker opencode says to run opencode auth login', async () => {
  const room = await setup('opencode start-fail room');
  const w = startWorker(room.created.join, { FAKE_ACP_NEW_FAIL: '1' }, 'opencode');
  assert.equal(await w.exit, 1);
  assert.match(w.err, /could not start the agent: auth required; if opencode is not signed in, run opencode auth login in a terminal/);
});

test('worker gemini sends no set_mode when the agent offers no modes', async () => {
  const room = await setup('gemini mode room');
  const w = startWorker(room.created.join, {}, 'gemini');
  await until(() => w.out.includes('gemini-1 is listening'));
  assert.doesNotMatch(w.out, /mode/);
  assert.deepEqual(readPrompts().modes ?? [], []);
});

test('an unknown harness exits 1 listing the supported ones', async () => {
  const room = await setup('unknown harness room');
  const w = startWorker(room.created.join, {}, 'foo');
  assert.equal(await w.exit, 1);
  assert.match(w.err, /supported: claude, codex, gemini, opencode/);
});

for (const harness of ['dsh']) {
  test(`worker ${harness} is refused: it hears the room from its own terminal`, async () => {
    const room = await setup(`${harness} refused room`);
    const w = startWorker(room.created.join, {}, harness);
    assert.notEqual(await w.exit, 0);
    assert.match(w.err, /hears the room from its own terminal/);
    assert.doesNotMatch(w.err, /supported:/);
  });
}

const settings = (room, body) => fetch(`${room.created.page}/api/settings`, json(body));

test('headless budgets validate, show in the state and the agent view, and note only real changes', async () => {
  const room = await setup('budget room');
  const first = await (await fetch(`${room.created.page}/api/state`)).json();
  assert.deepEqual(first.headless, { wakesPerHour: 20, runMinutes: 10, idleMinutes: 60 });
  for (const bad of [{ wakesPerHour: 0 }, { wakesPerHour: 121 }, { runMinutes: 1.5 }, { idleMinutes: 4 }, { idleMinutes: 1441 }, { runMinutes: '5' }, {}]) {
    assert.equal((await settings(room, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await settings(room, { wakesPerHour: 5, runMinutes: 2, idleMinutes: 30 })).status, 200);
  assert.equal((await settings(room, { wakesPerHour: 5 })).status, 200);
  const next = await (await fetch(`${room.created.page}/api/state`)).json();
  assert.deepEqual(next.headless, { wakesPerHour: 5, runMinutes: 2, idleMinutes: 30 });
  assert.equal(next.messages.filter((m) => m.text === 'you set headless budgets: 5 wakes/h, 2 min/run, stop after 30 min idle').length, 1);
  assert.deepEqual((await (await fetch(`${room.claude.link}/me`)).json()).headless, next.headless);
  assert.equal((await settings(room, { roundCap: 7 })).status, 200);
  assert.equal((await (await fetch(`${room.created.page}/api/state`)).json()).roundCap, 7);
});

test('the human stops a listening worker, which leaves and exits 0', async () => {
  const room = await setup('stop room');
  const w = startWorker(room.created.join);
  await until(() => w.out.includes('codex-1 is listening'));
  assert.equal((await fetch(`${room.created.page}/api/agents/nobody/stop`, json({}))).status, 404);
  assert.equal((await fetch(`${room.created.page}/api/agents/claude-1/stop`, json({}))).status, 409);
  assert.equal((await fetch(`${room.claude.link}/api/agents/codex-1/stop`, json({}))).status, 404);
  assert.equal((await fetch(`${room.created.page}/api/agents/codex-1/stop`, json({}))).status, 200);
  assert.equal((await fetch(`${room.created.page}/api/agents/codex-1/stop`, json({}))).status, 200);
  assert.equal(await w.exit, 0);
  assert.match(w.out, /codex-1 stopped by @you/);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
  const texts = (await state(room)).map((m) => m.text);
  assert.equal(texts.filter((t) => t === 'you asked codex-1 to stop').length, 1);
  assert.equal((await fetch(`${room.created.page}/api/agents/codex-1/stop`, json({}))).status, 404);
});

test('a stop asked during a run lets the run finish and its reply post first', async () => {
  const room = await setup('stop run room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '1200' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 work');
  await until(() => w.out.includes('running on'));
  await fetch(`${room.created.page}/api/agents/codex-1/stop`, json({}));
  assert.equal(await w.exit, 0);
  assert.equal((await codexPosts(room)).filter((m) => m.text.startsWith('echo(')).length, 1);
  assert.match(w.out, /replied/);
});

test('wakes per hour from the env: a second mention waits for the window, with one note', async () => {
  const room = await setup('wake env room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_WAKES_PER_HOUR: '1', AGENT_HUDDLE_WAKE_WINDOW_MS: '1500', AGENT_HUDDLE_GATE_POLL_MS: '200' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 one');
  await until(async () => (await codexPosts(room)).length === 1);
  await say(room.claude, '@codex-1 two');
  const note = await until(async () => (await codexPosts(room)).find((m) => m.text.includes('wake')));
  assert.match(note.text, /^@you codex-1 used its 1 wake this hour; next wake at \d\d:\d\d$/);
  await until(async () => (await codexPosts(room)).length === 3);
  assert.equal(readPrompts().prompts.length, 2);
  assert.equal((await codexPosts(room)).filter((m) => m.text.includes('wake')).length, 1);
  w.proc.kill('SIGTERM');
  await w.exit;
});

test('an out-of-wakes worker leaves messages unread, then runs one prompt with all of them', async () => {
  const room = await setup('wake unread room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_WAKES_PER_HOUR: '1', AGENT_HUDDLE_WAKE_WINDOW_MS: '2500', AGENT_HUDDLE_GATE_POLL_MS: '100' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 one');
  await until(async () => (await codexPosts(room)).length === 1);
  await say(room.claude, '@codex-1 two');
  await until(async () => (await codexPosts(room)).some((m) => m.text.includes('used its 1 wake')));
  await say(room.claude, '@codex-1 three');
  await sleep(300);
  assert.equal(readPrompts().prompts.length, 1);
  await until(async () => (await codexPosts(room)).filter((m) => m.text.startsWith('echo(')).length === 2);
  const { prompts } = readPrompts();
  assert.equal(prompts.length, 2);
  assert.match(prompts[1].text, /@codex-1 two\n.*@codex-1 three/);
  assert.equal((await codexPosts(room)).filter((m) => m.text.includes('wake')).length, 1);
  w.proc.kill('SIGTERM');
  await w.exit;
});

test('a worker out of wakes shows as asleep, then working again once it runs', async () => {
  const room = await setup('asleep room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_WAKES_PER_HOUR: '1', AGENT_HUDDLE_WAKE_WINDOW_MS: '3000', AGENT_HUDDLE_GATE_POLL_MS: '100' });
  await until(() => w.out.includes('codex-1 is listening'));
  const presence = async () => (await (await fetch(`${room.created.page}/api/state`)).json()).agents.find((x) => x.handle === 'codex-1').presence;
  await say(room.claude, '@codex-1 one');
  await until(async () => (await codexPosts(room)).length === 1);
  await say(room.claude, '@codex-1 two');
  await until(async () => (await presence()) === 'asleep');
  await until(async () => (await codexPosts(room)).filter((m) => m.text.startsWith('echo(')).length === 2);
  w.proc.kill('SIGTERM');
  await w.exit;
});

test('wakes per hour from the room settings when the env is unset', async () => {
  const room = await setup('wake room settings');
  await settings(room, { wakesPerHour: 1 });
  const w = startWorker(room.created.join, { AGENT_HUDDLE_WAKE_WINDOW_MS: '60000', AGENT_HUDDLE_GATE_POLL_MS: '200' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 one');
  await until(async () => (await codexPosts(room)).length === 1);
  await say(room.claude, '@codex-1 two');
  await until(async () => (await codexPosts(room)).some((m) => m.text.includes('used its 1 wake')));
  await sleep(500);
  assert.equal(readPrompts().prompts.length, 1);
  w.proc.kill('SIGTERM');
  await w.exit;
});

test('a worker idle past its limit leaves and exits 0 without being mentioned', async () => {
  const room = await setup('idle room');
  const w = startWorker(room.created.join, { AGENT_HUDDLE_IDLE_MS: '800' });
  assert.equal(await w.exit, 0);
  assert.match(w.out, /codex-1 stopped after \d+ min idle/);
  const who = await (await fetch(`${room.claude.link}/who`)).json();
  assert.equal(who.agents.find((a) => a.handle === 'codex-1').status, 'left');
});

test('the room state shows a requested stop and lists the supported harnesses', async () => {
  const room = await setup('stop state room');
  const w = startWorker(room.created.join, { FAKE_ACP_DELAY_MS: '1200' });
  await until(() => w.out.includes('codex-1 is listening'));
  await say(room.claude, '@codex-1 work');
  await until(() => w.out.includes('running on'));
  await fetch(`${room.created.page}/api/agents/codex-1/stop`, json({}));
  const st = await (await fetch(`${room.created.page}/api/state`)).json();
  assert.equal(st.agents.find((a) => a.handle === 'codex-1').stopRequested, true);
  assert.equal(st.agents.find((a) => a.handle === 'claude-1').stopRequested, false);
  assert.deepEqual(st.harnesses, [['claude', 'Claude Code'], ['codex', 'Codex'], ['gemini', 'Gemini CLI'], ['opencode', 'opencode']]);
  await w.exit;
});

test('each worker harness launches its pinned adapter', () => {
  const cmd = (h) => WORKER_HARNESSES[h].argv();
  assert.deepEqual(cmd('claude'), ['bunx', '@agentclientprotocol/claude-agent-acp@0.91.0']);
  assert.equal(WORKER_HARNESSES.claude.mode, 'acceptEdits');
  assert.ok(Object.hasOwn(WORKER_HARNESSES.claude.env, 'ANTHROPIC_API_KEY') && WORKER_HARNESSES.claude.env.ANTHROPIC_API_KEY === undefined);
  assert.deepEqual(cmd('codex'), ['bunx', '@agentclientprotocol/codex-acp@2.2.2']);
  assert.equal(WORKER_HARNESSES.codex.env.INITIAL_AGENT_MODE, 'workspace-write');
  assert.equal(cmd('gemini').at(-1), '--acp');
  assert.equal(WORKER_HARNESSES.gemini.mode, 'autoEdit');
  assert.equal(cmd('opencode').at(-1), 'acp');
  assert.equal(WORKER_HARNESSES.opencode.mode, 'build');
  assert.deepEqual(JSON.parse(WORKER_HARNESSES.opencode.env.OPENCODE_CONFIG_CONTENT), { permission: { edit: 'allow', bash: 'ask' } });
  assert.deepEqual(Object.keys(WORKER_HARNESSES), ['claude', 'codex', 'gemini', 'opencode']);
});

test('a headless worker starts with the room folder and the brief', async () => {
  const { created, claude } = await setup('brief room', '--dir', home);
  assert.equal((await fetch(`${created.page}/api/brief`, json({ text: 'Build the sprite loader' }))).status, 200);
  const w = startWorker(created.join);
  await until(() => w.out.includes('codex-1 is listening'));
  await say(claude, '@codex-1 go');
  const prompt = await until(() => readPrompts().prompts[0]);
  assert.ok(prompt.text.includes(`Room folder: ${home}`));
  assert.match(prompt.text, /Brief \(set by @you at \d\d:\d\d\):\nBuild the sprite loader/);
});

test('worker codex says how to let it reach 127.0.0.1 unless network_access is set', async () => {
  const room = await setup('network room');
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-codex-home-'));
  const hint = /codex-1 reaches the room through 127\.0\.0\.1, which the Codex sandbox blocks: approve network access when asked \(on the room page for a headless agent\) or set network_access = true under \[sandbox_workspace_write\] in ~\/\.codex\/config\.toml/;
  const first = startWorker(room.created.join, { HOME: fakeHome });
  await until(() => first.out.includes('codex-1 is listening'));
  assert.match(first.out, hint);
  first.proc.kill('SIGTERM');
  await first.exit;

  fs.mkdirSync(path.join(fakeHome, '.codex'));
  fs.writeFileSync(path.join(fakeHome, '.codex', 'config.toml'), '[sandbox_workspace_write]\nnetwork_access = true\n');
  const second = startWorker(room.created.join, { HOME: fakeHome });
  await until(() => second.out.includes('is listening'));
  assert.doesNotMatch(second.out, /sandbox blocks/);
  second.proc.kill('SIGTERM');
  await second.exit;
  fs.rmSync(fakeHome, { recursive: true, force: true });
});
