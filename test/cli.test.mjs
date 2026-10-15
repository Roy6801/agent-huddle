import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { serverDefaults, withRunningNote } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-'));
let env;

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function run(childEnv, ...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env: childEnv }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

const cli = (...args) => run(env, ...args);

function serverPids(dir) {
  return execFileSync('ps', ['eww', '-ax', '-o', 'pid=,command='], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.includes('huddle.mjs serve') && line.includes(`AGENT_HUDDLE_HOME=${dir}`));
}

const serverJson = () => JSON.parse(fs.readFileSync(path.join(home, 'server.json'), 'utf8'));

after(async () => {
  if (env) await cli('down');
  fs.rmSync(home, { recursive: true, force: true });
});

test('new twice reuses one server and prints join and page URLs', async () => {
  const port = await freePort();
  env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(port) };

  const first = await cli('new', 'sprite', 'game');
  assert.equal(first.code, 0, first.stderr);
  const a = JSON.parse(first.stdout);
  const info = serverJson();
  assert.equal(info.port, port);
  assert.equal(a.name, 'sprite game');
  assert.ok(a.join.startsWith(`http://127.0.0.1:${port}/s/`));
  assert.match(a.page, /\/s\/[^/]+\/h\/[^/]+$/);

  const second = await cli('new');
  const b = JSON.parse(second.stdout);
  assert.ok(b.join.startsWith(`http://127.0.0.1:${port}/s/`));
  assert.notEqual(a.id, b.id);
  assert.equal(serverJson().pid, info.pid);

  const upAgain = await cli('up');
  assert.equal(upAgain.stdout.trim(), `http://127.0.0.1:${port}`);
  assert.equal(serverJson().pid, info.pid);

  const proto = await fetch(a.join);
  assert.match(await proto.text(), /sprite game/);

  assert.ok(a.invite.includes(`${a.join}/join`));
  const byId = await cli('invite', a.id.slice(0, 8));
  assert.equal(byId.code, 0, byId.stderr);
  assert.equal(byId.stdout.trim(), a.invite);
  const byName = await cli('invite', 'sprite');
  assert.equal(byName.stdout.trim(), a.invite);
  const none = await cli('invite', 'nothing-like-this');
  assert.notEqual(none.code, 0);
  assert.match(none.stderr, /No live room matches/);
});

test('new --round-cap sets the room cap and rejects bad values', async () => {
  const made = await cli('new', 'capped', '--round-cap', '3');
  assert.equal(made.code, 0, made.stderr);
  const room = JSON.parse(made.stdout);
  assert.equal(room.name, 'capped');
  const state = await (await fetch(`${room.page}/api/state`)).json();
  assert.equal(state.roundCap, 3);

  const off = JSON.parse((await cli('new', '--round-cap=off')).stdout);
  assert.equal((await (await fetch(`${off.page}/api/state`)).json()).roundCap, null);

  for (const bad of ['0', '101', 'x']) {
    const res = await cli('new', '--round-cap', bad);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /--round-cap must be/);
  }
});

test('new --dir stores the folder, defaults to the cwd, and the worker path is human-only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-dir-'));
  const made = JSON.parse((await cli('new', 'foldered', '--dir', dir)).stdout);
  const state = await (await fetch(`${made.page}/api/state`)).json();
  assert.equal(state.folder, dir);
  assert.equal(state.worker, CLI);

  const plain = JSON.parse((await cli('new')).stdout);
  assert.equal((await (await fetch(`${plain.page}/api/state`)).json()).folder, process.cwd());

  const joined = await (await fetch(`${made.join}/join`, { method: 'POST', body: JSON.stringify({ harness: 'codex' }) })).json();
  const me = await (await fetch(`${joined.link}/me`)).json();
  assert.ok(!('worker' in me));
  assert.equal(me.folder, dir);
  assert.equal(joined.folder, dir);
  assert.ok((await (await fetch(joined.link)).text()).includes(dir));
});

test('new --dir refuses a folder that does not exist and creates no room', async () => {
  const missing = path.join(os.tmpdir(), `huddle-missing-${process.pid}-${Date.now()}`);
  const res = await cli('new', 'ghostroom', '--dir', missing);
  assert.equal(res.code, 1);
  assert.ok(res.stderr.includes(`--dir is not a folder: ${missing}`), res.stderr);
  const rooms = await cli('ls', '--json');
  assert.ok(!rooms.stdout.includes('ghostroom'));
});

test('join --lead makes the joiner the room lead', async () => {
  const room = JSON.parse((await cli('new', 'led')).stdout);
  assert.equal(typeof room.lead, 'string');
  const joined = JSON.parse((await cli('join', room.join, '--harness', 'codex', `--lead=${room.lead}`)).stdout);
  assert.equal(joined.lead, joined.handle);
  assert.equal(joined.role, 'lead');
  const again = JSON.parse((await cli('join', room.join, '--harness', 'claude', '--lead', room.lead)).stdout);
  assert.equal(again.lead, joined.handle);
  assert.equal(again.role, null);
  assert.equal(joined.brief, null);
  assert.equal(joined.folder, process.cwd());
});

test('join reports the current folder, and --folder overrides it', async () => {
  const room = JSON.parse((await cli('new', 'reported')).stdout);
  const mine = JSON.parse((await cli('join', room.join, '--harness', 'codex')).stdout);
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-dir-'));
  const given = JSON.parse((await cli('join', room.join, '--harness', 'claude', '--folder', other)).stdout);
  const agents = (await (await fetch(`${room.page}/api/state`)).json()).agents;
  assert.equal(agents.find((x) => x.handle === mine.handle).folder, process.cwd());
  assert.equal(agents.find((x) => x.handle === given.handle).folder, other);
});

test('join --folder without a value fails', async () => {
  const room = JSON.parse((await cli('new', 'nofolder')).stdout);
  const res = await cli('join', room.join, '--harness', 'codex', '--folder');
  assert.equal(res.code, 1);
  assert.ok(res.stderr.includes('--folder needs a folder path'), res.stderr);
});

test('POST /new rejects a relative or oversized folder and accepts none', async () => {
  const { page } = JSON.parse((await cli('new')).stdout);
  const origin = new URL(page).origin;
  const post = (body) => fetch(`${origin}/new`, { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await post({ folder: 'relative/dir' })).status, 400);
  assert.equal((await post({ folder: 42 })).status, 400);
  assert.equal((await post({ folder: `/${'a'.repeat(1024)}` })).status, 400);
  const none = await (await post({})).json();
  assert.equal((await (await fetch(`${none.page}/api/state`)).json()).folder, null);
});

test('wait prints the off-shift wake and exits 5 when the last task is done', async () => {
  const room = JSON.parse((await cli('new', 'shift')).stdout);
  const join = async (harness) =>
    (await fetch(`${room.join}/join`, { method: 'POST', body: JSON.stringify({ harness }) })).json();
  const a = await join('claude');
  const b = await join('codex');
  await fetch(`${b.link}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'only task' }) });
  await fetch(`${a.link}/read`);
  const waiting = cli('wait', a.link, '--minutes', '1');
  await new Promise((r) => setTimeout(r, 500));
  await fetch(`${b.link}/tasks/1/done`, { method: 'POST', body: JSON.stringify({ note: 'done' }) });
  const r = await waiting;
  assert.equal(r.code, 5, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.offShift, true);
  assert.ok(out.messages.some((m) => m.offShift && /you are off shift/.test(m.text)));
});

test('doctor passes while the server runs, down stops it', async () => {
  const doctor = await cli('doctor');
  assert.equal(doctor.code, 0, doctor.stdout);
  assert.match(doctor.stdout, /✓ server healthy/);

  const { pid, port } = serverJson();
  const down = await cli('down');
  assert.equal(down.stdout.trim(), 'stopped');
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));
  assert.throws(() => process.kill(pid, 0));
  assert.equal(fs.existsSync(path.join(home, 'server.json')), false);
});

test('concurrent up calls share one server', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-'));
  const port = await freePort();
  const own = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(port) };
  try {
    const results = await Promise.all([run(own, 'up'), run(own, 'up'), run(own, 'up')]);
    for (const res of results) {
      assert.equal(res.code, 0, res.stderr);
      assert.equal(res.stdout.trim(), `http://127.0.0.1:${port}`);
    }
    await new Promise((res) => setTimeout(res, 500));
    assert.equal(serverPids(dir).length, 1, serverPids(dir).join('\n'));
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'server.json'), 'utf8'));
    assert.equal(info.port, port);
    assert.doesNotThrow(() => process.kill(info.pid, 0));
  } finally {
    await run(own, 'down');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('up recovers from a stale server.json', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-'));
  const port = await freePort();
  const stalePort = await freePort();
  const own = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(port) };
  const dead = execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], {
    encoding: 'utf8',
  });
  fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port: stalePort, pid: Number(dead) }));
  try {
    const res = await run(own, 'up');
    assert.equal(res.code, 0, res.stderr);
    assert.equal(res.stdout.trim(), `http://127.0.0.1:${port}`);
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'server.json'), 'utf8'));
    assert.equal(info.port, port);
    assert.notEqual(info.pid, Number(dead));
  } finally {
    await run(own, 'down');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('help prints usage', async () => {
  const res = await cli('help');
  assert.match(res.stdout, /Usage: node huddle.mjs/);
});

test('start and rooms are aliases of new and ls', async () => {
  const made = await cli('start', 'alias room');
  assert.equal(made.code, 0, made.stderr);
  const room = JSON.parse(made.stdout);
  assert.equal(room.name, 'alias room');

  const listed = await cli('rooms', '--json');
  assert.equal(listed.code, 0, listed.stderr);
  assert.ok(JSON.parse(listed.stdout).some((r) => r.join === room.join));

  const help = await cli('help');
  assert.match(help.stdout, /new, start +create a room/);
  assert.match(help.stdout, /ls, rooms +list live rooms/);
  assert.match((await cli('help', 'start')).stdout, /new \[name\]/);
});

test('the repo checkout defaults to its own port and home; installed copies keep 4747 and ~/.agent-huddle', () => {
  const dev = { port: 4848, home: path.join(os.homedir(), '.agent-huddle-dev') };
  const installed = { port: 4747, home: path.join(os.homedir(), '.agent-huddle') };
  assert.deepEqual(serverDefaults(CLI), dev);

  const place = (...parts) => {
    const file = path.join(home, 'copies', ...parts, 'skills', 'agent-huddle', 'huddle.mjs');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    return file;
  };
  assert.deepEqual(serverDefaults(place('agents')), installed);
  const plugin = place('plugins', 'cache', 'agent-huddle', 'agent-huddle', '0.3.5');
  fs.writeFileSync(path.join(plugin, '..', '..', '..', 'package.json'), JSON.stringify({ name: 'agent-huddle' }));
  assert.deepEqual(serverDefaults(plugin), installed);
});

test('AGENT_HUDDLE_PORT and AGENT_HUDDLE_HOME win over the checkout defaults', async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-cli-env-'));
  const own = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(port) };
  try {
    const made = await run(own, 'new', 'qa room');
    assert.equal(made.code, 0, made.stderr);
    assert.match(made.stdout, new RegExp(`127\\.0\\.0\\.1:${port}/`));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'server.json'), 'utf8')).port, port);
  } finally {
    await run(own, 'down');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('start says when a server was already running, with its live rooms', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-run-'));
  const own = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(await freePort()) };
  try {
    const first = JSON.parse((await run(own, 'new', 'wordfreq')).stdout);
    assert.doesNotMatch(first.announce, /already running/);
    const second = JSON.parse((await run(own, 'start', 'qa room')).stdout);
    assert.match(second.announce.split('\n\n')[1], /^The agent-huddle server was already running \(version [\d.]+\) with live room "wordfreq"\.$/);
    const third = JSON.parse((await run(own, 'start', 'docs pass')).stdout);
    const line = third.announce.split('\n\n')[1];
    assert.match(line, /live rooms "qa room" and "wordfreq"/);
    assert.doesNotMatch(line, /docs pass/);
  } finally {
    await run(own, 'down');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the already-running note covers no rooms and a version mismatch', () => {
  const note = withRunningNote('Room "x" is ready.\n\nrest', '0.0.1', []).split('\n\n');
  assert.equal(note[0], 'Room "x" is ready.');
  assert.match(note[1], /\(version 0\.0\.1; this command is [\d.]+, so they differ\) with no other rooms\.$/);
  assert.equal(note[2], 'rest');
});

test('--help after a command prints its usage and has no side effects', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-help-'));
  const e = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(await freePort()) };
  for (const args of [['new', '--help'], ['new', 'x', '-h'], ['end', '--help'], ['ls', '--help']]) {
    const r = await run(e, ...args);
    assert.equal(r.code, 0);
    assert.match(r.stdout, new RegExp(`${args[0]}`));
    assert.match(r.stdout, /Example/);
  }
  assert.equal(fs.existsSync(path.join(dir, 'server.json')), false);
});

test('new rejects an unknown option instead of naming a room after it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-help-'));
  const e = { ...process.env, AGENT_HUDDLE_HOME: dir, AGENT_HUDDLE_PORT: String(await freePort()) };
  const r = await run(e, 'new', '--bogus');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Unknown option "--bogus"/);
  assert.equal(fs.existsSync(path.join(dir, 'server.json')), false);
});

test('AC-30.4: home --print starts the server and prints the same owner-only home link every run', async () => {
  const first = await cli('home', '--print');
  assert.equal(first.code, 0, first.stderr);
  const keyFile = path.join(home, 'home-key');
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  assert.equal(first.stdout.trim(), `http://127.0.0.1:${serverJson().port}/home/${key}`);
  assert.equal(fs.statSync(keyFile).mode & 0o777, 0o600);
  assert.equal((await cli('home', '--print')).stdout, first.stdout);
  const rooms = await fetch(`${first.stdout.trim()}/api/rooms`);
  assert.equal(rooms.status, 200);
  assert.ok(Array.isArray((await rooms.json()).past));
});
