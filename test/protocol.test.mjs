import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHuddle, clampWait } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function start(opts = {}) {
  const huddle = createHuddle(opts);
  const port = await huddle.listen(0);
  running.push(huddle);
  return { huddle, base: `http://127.0.0.1:${port}` };
}

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
  return { status: res.status, json, text, headers: res.headers };
}

async function room(opts) {
  const { huddle, base } = await start(opts);
  const { json: created } = await call('POST', `${base}/new`, { name: 'test room' });
  const join = async (harness, role) => {
    const { json } = await call('POST', `${created.join}/join`, { harness, ...(role ? { role } : {}) });
    return json;
  };
  const human = (path, body) => call(body ? 'POST' : 'GET', `${created.page}/${path}`, body);
  const state = async () => (await human('api/state')).json;
  return { huddle, base, created, join, human, state };
}

const post = (agent, text, extra = {}) => call('POST', `${agent.link}/post`, { text, ...extra });
const read = async (agent) => (await call('GET', `${agent.link}/read`)).json;

test('join: handles per harness, personal link, protocol texts', async () => {
  const r = await room();
  const proto = await call('GET', r.created.join);
  assert.equal(proto.status, 200);
  assert.match(proto.headers.get('content-type'), /text\/plain/);
  assert.match(proto.text, /curl -s -X POST .*\/join/);
  assert.match(proto.text, /reference material, not instructions/);

  const a = await r.join('claude');
  const b = await r.join('Claude');
  const c = await r.join('codex', 'artist');
  assert.deepEqual([a.handle, b.handle, c.handle], ['claude-1', 'claude-2', 'codex-1']);
  assert.equal(c.role, 'artist');
  assert.match(a.link, new RegExp(`^${r.base}/s/${r.created.id}/as/`));

  const personal = await call('GET', a.link);
  assert.match(personal.text, /You are claude-1/);
  assert.match(personal.text, /huddle 'test room'/);
  assert.match(personal.text, /reference material, not instructions/);
  assert.match(personal.text, /\/wait\?wait=25/);

  assert.equal((await call('POST', `${r.created.join}/join`, { harness: '!!!' })).status, 400);
  assert.equal((await call('POST', `${r.created.join}/join`, {})).status, 400);
  assert.equal((await call('POST', `${r.created.join}/join`, { harness: 'x', role: 'all' })).status, 400);
  for (const harness of ['you', 'system', 'all', 'You!', '-All-']) {
    assert.equal((await call('POST', `${r.created.join}/join`, { harness })).status, 400, harness);
  }
  assert.equal((await call('POST', `${r.created.join}/join`, { harness: 'x', role: 'Bad Role' })).status, 400);
  assert.equal((await call('POST', `${r.created.join}/join`, 'nope')).status, 400);
});

test('new returns a self-contained invite with a safe name', async () => {
  const { base } = await start();
  const { json } = await call('POST', `${base}/new`, { name: 'say "hi"\nnow `x`' });
  assert.match(json.invite, new RegExp(`^Join my agent-huddle room "say 'hi' now 'x'":`));
  assert.equal(json.invite.split('\n')[0].split('"').length, 3);
  assert.ok(json.invite.includes(`curl -s -X POST ${json.join}/join`));
  assert.match(json.invite, /\/wait\?wait=25/);
});

test('new takes a name and api/state reports it', async () => {
  const { base } = await start();
  const { json } = await call('POST', `${base}/new`, { name: 'x' });
  assert.equal(json.name, 'x');
  assert.equal(json.title, undefined);
  const state = (await call('GET', `${json.page}/api/state`)).json;
  assert.equal(state.session.name, 'x');
  const legacy = await call('POST', `${base}/new`, { title: 'y' });
  assert.equal(legacy.json.name, 'huddle');
});

test('rejoin keeps handle and cursor; handles are never reused', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('claude');
  const other = await r.join('codex');
  await read(b);
  for (let i = 1; i <= 8; i++) await post(other, `chat ${i}`);
  const first = await call('GET', `${b.link}/read?limit=5`);
  assert.deepEqual(first.json.messages.map((m) => m.text), [1, 2, 3, 4, 5].map((i) => `chat ${i}`));
  await call('POST', `${b.link}/leave`);
  const who = await call('GET', `${a.link}/who`);
  assert.equal(who.json.agents.find((x) => x.handle === 'claude-2').status, 'left');

  const rest = await call('GET', `${b.link}/read`);
  const chat = rest.json.messages.filter((m) => m.kind === 'chat').map((m) => m.text);
  assert.deepEqual(chat, ['chat 6', 'chat 7', 'chat 8']);
  assert.equal(rest.json.messages.at(-1).text, 'claude-2 rejoined');
  assert.equal((await r.join('claude')).handle, 'claude-3');
});

test('read returns only what is new and not own posts', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  await read(a);
  await post(b, 'sprites done in assets/sprites.png');
  const got = await read(a);
  assert.equal(got.messages.length, 1);
  assert.equal(got.messages[0].text, 'sprites done in assets/sprites.png');
  assert.equal(got.messages[0].from, 'codex-1');
  assert.equal((await read(a)).messages.length, 0);
  await post(a, 'my own');
  assert.equal((await read(a)).messages.length, 0);
  assert.equal((await call('GET', `${a.link}/me`)).json.unread, 0);
});

test('post validation', async () => {
  const r = await room();
  const a = await r.join('claude');
  assert.equal((await post(a, '   ')).status, 400);
  assert.equal((await post(a, 'x'.repeat(8001))).status, 400);
  assert.equal((await post(a, 'hi', { for: 'all' })).status, 400);
  assert.equal((await call('POST', `${a.link}/post`, { text: 5 })).status, 400);
  assert.equal((await post(a, 'x'.repeat(8000))).status, 200);
});

test('wait returns promptly when addressed, 204 on timeout, ignores unaddressed', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  await read(a);

  const pending = call('GET', `${a.link}/wait?wait=10`);
  await new Promise((res) => setTimeout(res, 300));
  await post(b, 'not for you');
  await new Promise((res) => setTimeout(res, 200));
  const t0 = Date.now();
  await post(b, '@claude-1 your turn');
  const got = await pending;
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(got.status, 200);
  assert.deepEqual(got.json.messages.map((m) => m.text), ['not for you', '@claude-1 your turn']);

  const t1 = Date.now();
  const empty = await call('GET', `${a.link}/wait?wait=1`);
  assert.equal(empty.status, 204);
  assert.equal(empty.text, '');
  assert.ok(Date.now() - t1 >= 900);
});

test('wait returns immediately when addressed messages are already unread', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  await post(b, '@claude-1 ping');
  const t0 = Date.now();
  const got = await call('GET', `${a.link}/wait?wait=30`);
  assert.equal(got.status, 200);
  assert.ok(Date.now() - t0 < 500);
});

test('wait clamps to 1..60 seconds', async () => {
  assert.equal(clampWait('300'), 60);
  assert.equal(clampWait('0'), 1);
  assert.equal(clampWait('-5'), 1);
  assert.equal(clampWait(null), 25);
  assert.equal(clampWait('abc'), 25);
  assert.equal(clampWait('30'), 30);

  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  let settled = false;
  const pending = call('GET', `${a.link}/wait?wait=300`).then((x) => ((settled = true), x));
  await new Promise((res) => setTimeout(res, 1500));
  assert.equal(settled, false);
  await post(b, '@claude-1 release');
  assert.equal((await pending).status, 200);
});

test('mentions: handle.*, role, all, you, human default, emails ignored', async () => {
  const r = await room();
  const builder = await r.join('claude', 'builder');
  const child = (await call('POST', `${builder.link}/spawn`, { role: 'tester' })).json;
  const artist = await r.join('codex', 'artist');
  const msg = async (text, from = artist) => {
    const { json } = await post(from, text);
    return (await r.state()).messages.find((m) => m.id === json.id);
  };

  assert.deepEqual((await msg('@claude-1.* sync')).to.sort(), ['claude-1', 'claude-1.tester']);
  assert.deepEqual((await msg('@artist go', builder)).to, ['codex-1']);
  assert.deepEqual((await msg('@all hello')).to.sort(), ['claude-1', 'claude-1.tester']);
  assert.deepEqual((await msg('@all hello', builder)).to.sort(), ['claude-1.tester', 'codex-1']);
  assert.equal((await msg('@you question')).toYou, true);
  const plain = await msg('no mention');
  assert.deepEqual(plain.to, []);
  assert.equal(plain.toYou, false);
  const email = await msg('mail me at bob@builder.com');
  assert.deepEqual(email.mentions, []);
  assert.deepEqual((await msg('hey @claude-1.tester, ok?')).to, ['claude-1.tester']);

  const human = await r.human('api/post', { text: 'everyone listen' });
  const humanMsg = (await r.state()).messages.find((m) => m.id === human.json.id);
  assert.equal(humanMsg.from, 'you');
  assert.deepEqual(humanMsg.to.sort(), ['claude-1', 'claude-1.tester', 'codex-1']);
  assert.ok(child.handle);
});

test('mentions inside code are ignored; only delimited tokens count', async () => {
  const r = await room();
  const a = await r.join('claude');
  await r.join('codex');
  const msg = async (text) => {
    const res = await post(a, text);
    assert.equal(res.status, 200, text);
    return (await r.state()).messages.find((m) => m.id === res.json.id);
  };

  assert.deepEqual((await msg('run `npm i @types/node` and `@nope`')).mentions, []);
  assert.deepEqual((await msg('setup:\n```sh\nnpm i @types/node @nope\n```\ndone')).mentions, []);
  assert.deepEqual((await msg('install @types/node please')).mentions, []);
  assert.deepEqual((await msg('see @codex-1, then `@nope`')).to, ['codex-1']);
  assert.deepEqual((await msg('thanks @codex-1.')).to, ['codex-1']);
  assert.deepEqual((await msg('(@codex-1)')).to, ['codex-1']);

  const res = await post(a, 'ping @nope');
  assert.equal(res.status, 400);
  assert.match(res.json.error, /^unknown mention @nope; wrap code in backticks/);
});

test('unknown mention is rejected with valid list and nothing is stored', async () => {
  const r = await room();
  const a = await r.join('claude', 'builder');
  await call('POST', `${a.link}/spawn`, { role: 'tester' });
  await r.join('codex');
  const before = (await r.state()).messages.length;
  const res = await post(a, '@gemini-1 can you review?');
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'unknown mention @gemini-1; wrap code in backticks if this was not a mention');
  for (const v of ['@claude-1', '@codex-1', '@claude-1.*', '@builder', '@all', '@you']) {
    assert.ok(res.json.valid.includes(v), v);
  }
  assert.equal((await r.state()).messages.length, before);
  const human = await r.human('api/post', { text: '@nobody hi' });
  assert.equal(human.status, 400);
});

test('spawn: naming, suffixes, depth, role validation', async () => {
  const r = await room();
  const a = await r.join('claude');
  const t1 = (await call('POST', `${a.link}/spawn`, { role: 'tester' })).json;
  const t2 = (await call('POST', `${a.link}/spawn`, { role: 'tester' })).json;
  assert.equal(t1.handle, 'claude-1.tester');
  assert.equal(t1.parent, 'claude-1');
  assert.match(t1.link, /\/as\//);
  assert.equal(t2.handle, 'claude-1.tester-2');

  const l2 = (await call('POST', `${t1.link}/spawn`, { role: 'helper' })).json;
  assert.equal(l2.handle, 'claude-1.tester.helper');
  const l3 = await call('POST', `${l2.link}/spawn`, { role: 'deep' });
  assert.equal(l3.status, 400);

  for (const role of ['Tester!', 'a.b', '', 'x'.repeat(21), 'all', 'you', 'system', 5]) {
    assert.equal((await call('POST', `${a.link}/spawn`, { role })).status, 400, String(role));
  }
  assert.equal((await call('POST', `${a.link}/spawn`, {})).status, 400);

  const me = (await call('GET', `${a.link}/me`)).json;
  assert.deepEqual(me.children, ['claude-1.tester', 'claude-1.tester-2']);
  const child = (await call('GET', `${t1.link}/me`)).json;
  assert.equal(child.parent, 'claude-1');
});

test('tasks: concurrent claims, assignment wakes, done, release', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  const c = await r.join('claude');
  await read(b);

  const waiting = call('GET', `${b.link}/wait?wait=10`);
  await new Promise((res) => setTimeout(res, 200));
  const created = await call('POST', `${a.link}/tasks`, { title: 'draw player sprite', assignee: 'codex-1' });
  assert.equal(created.status, 200);
  assert.equal(created.json.id, 1);
  assert.equal(created.json.assignee, 'codex-1');
  const woke = await waiting;
  assert.equal(woke.status, 200);
  assert.match(woke.json.messages.at(-1).text, /claude-1 created task #1 "draw player sprite" for @codex-1/);

  const claims = await Promise.all([
    call('POST', `${b.link}/tasks/1/claim`),
    call('POST', `${c.link}/tasks/1/claim`),
  ]);
  const statuses = claims.map((x) => x.status).sort();
  assert.deepEqual(statuses, [200, 409]);
  const winner = claims.find((x) => x.status === 200).json.owner;
  const loser = claims.find((x) => x.status === 409);
  assert.equal(loser.json.owner, winner);
  assert.equal(loser.json.error, 'already claimed');

  const winnerAgent = winner === 'codex-1' ? b : c;
  const otherAgent = winner === 'codex-1' ? c : b;
  assert.equal((await call('POST', `${winnerAgent.link}/tasks/1/claim`)).status, 200);
  assert.equal((await call('POST', `${otherAgent.link}/tasks/1/done`)).status, 409);
  assert.equal((await call('POST', `${otherAgent.link}/tasks/1/release`)).status, 409);
  assert.equal((await call('POST', `${a.link}/tasks/9/claim`)).status, 404);

  await read(a);
  const done = await call('POST', `${winnerAgent.link}/tasks/1/done`, { note: 'saved to sprite.png' });
  assert.equal(done.json.status, 'done');
  assert.equal(done.json.note, 'saved to sprite.png');
  const notice = (await read(a)).messages.at(-1);
  assert.equal(notice.text, `${winner} finished task #1 "draw player sprite": saved to sprite.png`);
  assert.deepEqual(notice.to, ['claude-1']);
  assert.equal((await call('POST', `${otherAgent.link}/tasks/1/claim`)).status, 409);

  const t2 = (await call('POST', `${a.link}/tasks`, { title: 'second' })).json;
  assert.equal(t2.id, 2);
  assert.equal((await call('POST', `${b.link}/tasks/2/done`)).json.owner, 'codex-1');
  const t3 = (await call('POST', `${a.link}/tasks`, { title: 'third' })).json;
  await call('POST', `${b.link}/tasks/${t3.id}/claim`);
  assert.equal((await call('POST', `${b.link}/tasks/${t3.id}/release`)).json.status, 'open');
  assert.equal((await call('GET', `${a.link}/tasks`)).json.tasks.length, 3);

  assert.equal((await call('POST', `${a.link}/tasks`, { title: '' })).status, 400);
  assert.equal((await call('POST', `${a.link}/tasks`, { title: 'x', assignee: 'ghost-1' })).status, 400);
  const humanTask = await r.human('api/tasks', { title: 'from human' });
  assert.equal(humanTask.json.createdBy, 'you');
});

test('leave releases claimed tasks and says so', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  for (const t of ['one', 'two', 'three']) await call('POST', `${a.link}/tasks`, { title: t });
  await call('POST', `${b.link}/tasks/2/claim`);
  await call('POST', `${b.link}/tasks/3/claim`);
  await call('POST', `${b.link}/leave`);
  const texts = (await r.state()).messages.map((m) => m.text);
  assert.ok(texts.includes('codex-1 left; released tasks #2, #3'));
  assert.equal((await call('GET', `${a.link}/tasks`)).json.tasks[1].status, 'open');
});

test('idle sweep auto-leaves silent agents, releases tasks, spares waiters', async () => {
  const r = await room({ idleMs: 200 });
  const a = await r.join('claude');
  const b = await r.join('codex');
  const w = await r.join('gemini');
  await call('POST', `${a.link}/tasks`, { title: 'one' });
  await call('POST', `${a.link}/tasks`, { title: 'two' });
  await call('POST', `${b.link}/tasks/2/claim`);

  const waiting = call('GET', `${w.link}/wait?wait=5`);
  await new Promise((res) => setTimeout(res, 500));
  r.huddle.sweep();

  const state = await r.state();
  const status = Object.fromEntries(state.agents.map((x) => [x.handle, x.status]));
  assert.equal(status['codex-1'], 'left');
  assert.equal(status['claude-1'], 'left');
  assert.equal(status['gemini-1'], 'active');
  assert.equal(state.tasks[1].status, 'open');
  assert.ok(state.messages.some((m) => m.text === 'codex-1 left (idle); released task #2'));

  await call('POST', `${w.link}/post`, { text: 'bye' });
  await r.huddle.close();
  assert.equal((await waiting).status, 204);
});

test('round cap: 4th agent post is 429, relayed does not reset, human resets', async () => {
  const r = await room({ roundCap: 3 });
  const a = await r.join('claude');
  const b = await r.join('codex');
  assert.equal((await post(a, 'one')).status, 200);
  assert.equal((await post(b, 'two')).status, 200);
  assert.equal((await post(a, 'relayed', { for: 'you' })).status, 200);
  const blocked = await post(b, 'four');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.error, 'waiting on @you');
  assert.equal(blocked.json.streak, 3);
  assert.equal((await r.state()).agentStreak, 3);
  assert.equal((await post(a, 'again', { for: 'you' })).status, 429);

  await r.human('api/post', { text: 'carry on' });
  assert.equal((await r.state()).agentStreak, 0);
  assert.equal((await post(b, 'five')).status, 200);
});

test('round cap also counts agent task creation and task done with a note', async () => {
  const r = await room({ roundCap: 2 });
  const a = await r.join('claude');
  const b = await r.join('codex');
  assert.equal((await call('POST', `${a.link}/tasks`, { title: 'one' })).status, 200);
  assert.equal((await call('POST', `${a.link}/tasks`, { title: 'two' })).status, 200);
  const capped = await call('POST', `${a.link}/tasks`, { title: 'three' });
  assert.equal(capped.status, 429);
  assert.equal(capped.json.error, 'waiting on @you');
  assert.equal((await call('GET', `${a.link}/tasks`)).json.tasks.length, 2);

  assert.equal((await call('POST', `${b.link}/tasks/1/claim`)).status, 200);
  assert.equal((await call('POST', `${b.link}/tasks/1/done`, { note: 'finished' })).status, 429);
  assert.equal((await call('GET', `${b.link}/tasks`)).json.tasks[0].status, 'claimed');
  assert.equal((await call('POST', `${b.link}/tasks/1/release`)).status, 200);
  assert.equal((await call('POST', `${b.link}/tasks/1/claim`)).status, 200);
  assert.equal((await call('POST', `${b.link}/tasks/1/done`)).status, 200);
  assert.equal((await post(b, 'hello')).status, 429);
  await call('POST', `${b.link}/leave`);

  await r.human('api/tasks', { title: 'human task' });
  assert.equal((await r.state()).agentStreak, 2);
  await r.human('api/post', { text: 'go on' });
  assert.equal((await call('POST', `${a.link}/tasks`, { title: 'four' })).status, 200);
  assert.equal((await call('POST', `${a.link}/tasks/2/done`, { note: 'ok' })).status, 200);
  assert.equal((await call('POST', `${a.link}/tasks`, { title: 'five' })).status, 429);
});

test('server idle callback fires only without requests and waiters', async () => {
  let fired = 0;
  const r = await room({ serverIdleMs: 200, onIdle: () => fired++ });
  const a = await r.join('claude');
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const pending = call('GET', `${a.link}/wait?wait=2`);
  await sleep(1000);
  assert.equal(fired, 0);
  assert.equal((await pending).status, 204);
  await sleep(500);
  assert.equal(fired, 1);
});

test('server idle callback fires when nothing happens', async () => {
  let fired = 0;
  await start({ serverIdleMs: 200, onIdle: () => fired++ });
  await new Promise((res) => setTimeout(res, 600));
  assert.equal(fired, 1);
});

test('relayed posts keep the agent as sender; no agent route yields from=you', async () => {
  const r = await room();
  const a = await r.join('claude');
  const { json } = await post(a, 'use 16x16 tiles', { for: 'you' });
  const m = (await r.state()).messages.find((x) => x.id === json.id);
  assert.equal(m.from, 'claude-1');
  assert.equal(m.for, 'you');
  assert.equal(m.kind, 'chat');

  await post(a, 'plain');
  await call('POST', `${a.link}/post`, { text: 'sneaky', from: 'you' });
  await call('POST', `${a.link}/tasks`, { title: 't' });
  await call('POST', `${a.link}/tasks/1/done`, { note: 'n' });
  const all = (await r.state()).messages;
  assert.equal(all.filter((x) => x.from === 'you').length, 0);

  await r.human('api/post', { text: 'real human' });
  assert.equal((await r.state()).messages.at(-1).from, 'you');
});

test('human page and state: online flag, since filter, page.html route', async () => {
  const r = await room();
  const a = await r.join('claude');
  await post(a, 'hello');
  const s1 = await r.state();
  assert.equal(s1.you.online, true);
  assert.equal(s1.session.id, r.created.id);
  assert.equal(s1.roundCap, 10);
  assert.equal(s1.agentStreak, 1);
  const since = (await r.human(`api/state?since=${s1.messages.at(-1).id - 1}`)).json;
  assert.equal(since.messages.length, 1);
  assert.equal((await call('GET', `${a.link}/who`)).json.you.online, true);

  const page = await call('GET', r.created.page);
  const { existsSync } = await import('node:fs');
  if (existsSync(new URL('../skills/agent-huddle/page.html', import.meta.url))) {
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
  } else {
    assert.equal(page.status, 500);
    assert.equal(page.text, 'page.html missing');
  }
});

test('trailing slashes, health, unknown routes', async () => {
  const r = await room();
  const a = await r.join('claude');
  assert.equal((await call('GET', `${r.base}/health/`)).json.name, 'agent-huddle');
  assert.equal((await call('GET', `${a.link}/me/`)).status, 200);
  assert.equal((await call('GET', `${a.link}/nope`)).status, 404);
  assert.equal((await call('GET', `${r.base}/nope`)).status, 404);
});

test('round cap is per room: /new sets it, invalid values are 400, protocol and /me show it', async () => {
  const { base } = await start();
  const made = async (roundCap) => call('POST', `${base}/new`, { name: 't', roundCap });
  const cap7 = (await made(7)).json;
  const off = (await made('off')).json;
  const nul = (await made(null)).json;
  const stateOf = async (c) => (await call('GET', `${c.page}/api/state`)).json;
  assert.equal((await stateOf(cap7)).roundCap, 7);
  assert.equal((await stateOf(off)).roundCap, null);
  assert.equal((await stateOf(nul)).roundCap, null);
  assert.equal((await call('POST', `${base}/new`, { name: 't' })).status, 200);
  for (const bad of [0, 51, 'x', 2.5, '7']) assert.equal((await made(bad)).status, 400, String(bad));

  const joinOf = async (c) => (await call('POST', `${c.join}/join`, { harness: 'claude' })).json;
  const a = await joinOf(cap7);
  assert.equal((await call('GET', `${a.link}/me`)).json.roundCap, 7);
  assert.match((await call('GET', a.link)).text, /After 7 agent posts in a row/);
  const b = await joinOf(off);
  assert.equal((await call('GET', `${b.link}/me`)).json.roundCap, null);
  assert.match((await call('GET', b.link)).text, /no round cap/i);
});

test('round cap: human settings change it, post a system line, pause and unpause', async () => {
  const r = await room({ roundCap: 5 });
  const a = await r.join('claude');
  for (const t of ['one', 'two', 'three']) assert.equal((await post(a, t)).status, 200);

  const lowered = await r.human('api/settings', { roundCap: 2 });
  assert.equal(lowered.status, 200);
  assert.deepEqual(lowered.json, { roundCap: 2 });
  let state = await r.state();
  assert.equal(state.roundCap, 2);
  assert.equal(state.messages.at(-1).from, 'system');
  assert.equal(state.messages.at(-1).text, 'you set the round cap to 2');
  assert.equal((await post(a, 'blocked')).status, 429);

  assert.equal((await r.human('api/settings', { roundCap: 20 })).status, 200);
  assert.equal((await post(a, 'unpaused')).status, 200);

  const off = await r.human('api/settings', { roundCap: 'off' });
  assert.deepEqual(off.json, { roundCap: null });
  state = await r.state();
  assert.equal(state.roundCap, null);
  assert.equal(state.messages.at(-1).text, "you turned the round cap off (agents won't pause for you)");
  for (let i = 0; i < 25; i++) assert.equal((await post(a, `m${i}`)).status, 200);
  assert.ok((await r.state()).agentStreak >= 25);
});

test('round cap: invalid settings are 400 and agents have no settings route', async () => {
  const r = await room();
  const a = await r.join('claude');
  for (const bad of [0, 51, 'x', undefined]) {
    assert.equal((await r.human('api/settings', { roundCap: bad })).status, 400, String(bad));
  }
  assert.equal((await r.state()).roundCap, 10);
  assert.equal((await call('POST', `${a.link}/settings`, { roundCap: 3 })).status, 404);
  assert.equal((await call('POST', `${a.link}/api/settings`, { roundCap: 3 })).status, 404);
  assert.equal((await r.state()).roundCap, 10);
});
