import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const dirs = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

const tmpHome = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-history-cli-'));
  dirs.push(dir);
  return dir;
};

const run = (env, ...args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
  });

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const roomLine = (name, id, createdAt) => JSON.stringify({ type: 'room', at: createdAt, name, id, folder: null, createdAt, version: '0' });

test('AC-98: history lists past rooms newest first, ended or not, and skips half-written lines', async () => {
  const home = tmpHome();
  const dir = path.join(home, 'history');
  fs.mkdirSync(dir);
  const file = (n) => path.join(dir, n);
  const md = file('2026-10-01-done-aaaaaaaa.md');
  fs.writeFileSync(md, '# done\n');
  fs.writeFileSync(file('2026-10-01-done-aaaaaaaa.jsonl'),
    `${roomLine('done', 'aaaaaaaa', '2026-10-01T10:00:00.000Z')}\n${JSON.stringify({ type: 'end', at: '2026-10-01T10:30:00.000Z', transcript: md })}\n`);
  fs.writeFileSync(file('2026-10-03-live-bbbbbbbb.jsonl'), `${roomLine('live', 'bbbbbbbb', '2026-10-03T10:00:00.000Z')}\n`);
  fs.writeFileSync(file('2026-10-02-crashed-cccccccc.jsonl'), `${roomLine('crashed', 'cccccccc', '2026-10-02T10:00:00.000Z')}\n{"type":"mess`);
  fs.writeFileSync(file('2026-10-04-junk-dddddddd.jsonl'), '{"type":"mess');

  const out = await run({ ...process.env, AGENT_HUDDLE_HOME: home }, 'history');
  assert.equal(out.code, 0, out.stderr);
  const rows = out.stdout.trimEnd().split('\n');
  assert.deepEqual(rows.map((r) => r.trim().split(/\s+/)[0]), ['live', 'crashed', 'done']);
  assert.match(rows[0], /bbbbbbbb .* not ended .*2026-10-03-live-bbbbbbbb\.jsonl$/);
  assert.match(rows[1], /cccccccc .* not ended .*2026-10-02-crashed-cccccccc\.jsonl$/);
  assert.match(rows[2], new RegExp(`aaaaaaaa .* ended \\d\\d:\\d\\d +${md}$`));

  const empty = await run({ ...process.env, AGENT_HUDDLE_HOME: tmpHome() }, 'history');
  assert.deepEqual([empty.code, empty.stdout], [0, 'No room history yet.\n']);
  const help = await run(process.env, 'help');
  assert.match(help.stdout, /\n {2}history +list past rooms from history, newest first \(no server needed\)\n/);
  assert.match((await run(process.env, 'help', 'history')).stdout, /history\n\nlist past rooms/);
});

test('AC-96: a killed server leaves every line written, and history lists the room as not ended', async () => {
  const home = tmpHome();
  const env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
  const made = await run(env, 'new', 'killed room', '--round-cap', 'off');
  assert.equal(made.code, 0, made.stderr);
  const { pid } = JSON.parse(fs.readFileSync(path.join(home, 'server.json'), 'utf8'));
  let handle;
  try {
    const { join } = JSON.parse(made.stdout);
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const agent = await (await post(`${join}/join`, { harness: 'claude' })).json();
    handle = agent.handle;
    for (let i = 1; i <= 30; i++) assert.equal((await post(`${agent.link}/post`, { text: `message ${i}` })).status, 200);
  } finally {
    process.kill(pid, 'SIGKILL');
  }

  const dir = path.join(home, 'history');
  const [name, ...others] = fs.readdirSync(dir);
  assert.deepEqual(others, []);
  assert.match(name, /\.jsonl$/);
  const lines = fs.readFileSync(path.join(dir, name), 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].type, 'room');
  const texts = lines.filter((l) => l.type === 'message' && l.from === handle).map((m) => m.text);
  assert.deepEqual(texts, Array.from({ length: 30 }, (_, i) => `message ${i + 1}`));

  const out = await run(env, 'history');
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stdout, new RegExp(`^ {2}killed room .* not ended +${path.join(dir, name)}\\n$`));
});

test('the server writes history under AGENT_HUDDLE_HOME, and a transcript that cannot be written still ends the room', async () => {
  const home = tmpHome();
  const dir = path.join(home, 'history');
  const env = { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(await freePort()) };
  try {
    const made = await run(env, 'new', 'home room');
    assert.equal(made.code, 0, made.stderr);
    const { id } = JSON.parse(made.stdout);
    assert.deepEqual(fs.readdirSync(dir).map((f) => f.slice(11)), [`home-room-${id.slice(0, 8)}.jsonl`]);
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    const ended = await run(env, 'end', id, '--yes', '--keep-server');
    const transcript = ended.stdout.match(new RegExp(`\nTranscript: (${dir}/.*-${id.slice(0, 8)}\\.md)\n`))?.[1];
    assert.ok(transcript && fs.existsSync(transcript), ended.stdout);

    const broken = JSON.parse((await run(env, 'new', 'broken room')).stdout);
    const jsonl = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(`-${broken.id.slice(0, 8)}.jsonl`)));
    fs.mkdirSync(jsonl.replace(/\.jsonl$/, '.md'));
    const failed = await run(env, 'end', broken.id, '--yes', '--keep-server');
    assert.match(failed.stdout, new RegExp(`\nNo transcript written: EISDIR; history is at ${jsonl}\n`));
    assert.match(fs.readFileSync(jsonl, 'utf8'), /"type":"end","transcript":null}\n$/);
    assert.match((await run(env, 'history')).stdout, new RegExp(`^ {2}broken room .* ended .* ${jsonl}$`, 'm'));

    if (process.getuid?.() !== 0) {
      fs.chmodSync(dir, 0o500);
      const second = JSON.parse((await run(env, 'new', 'off room')).stdout);
      const off = await run(env, 'end', second.id, '--yes', '--keep-server');
      assert.match(off.stdout, /\nNo transcript written: history is not being saved \(EACCES\)\.\n/);
    }
  } finally {
    if (fs.existsSync(dir)) fs.chmodSync(dir, 0o700);
    await run(env, 'down');
  }
});
