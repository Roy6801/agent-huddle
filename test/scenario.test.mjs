import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const TOKEN = 'scenario-admin-token';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function check(ok, n, name, agent, expected, got) {
  if (ok) return;
  throw new assert.AssertionError({
    message: `checkpoint ${n} (${name}): ${agent} expected ${expected}, server answered ${JSON.stringify(got)}`,
  });
}

function agent(joined) {
  const { handle, link } = joined;
  return {
    handle,
    link,
    waiting: false,
    next: null,
    post: (text, extra = {}) => call('POST', `${link}/post`, { text, ...extra }),
    read: () => call('GET', `${link}/read`),
    createTask: (body) => call('POST', `${link}/tasks`, body),
    claim: (n) => call('POST', `${link}/tasks/${n}/claim`, {}),
    done: (n, note) => call('POST', `${link}/tasks/${n}/done`, { note }),
    tasks: () => call('GET', `${link}/tasks`),
    files: () => call('GET', `${link}/files`),
    spawn: (role) => call('POST', `${link}/spawn`, { role }),
    leave: () => call('POST', `${link}/leave`, {}),
    upload: async (name, data) => {
      const res = await fetch(`${link}/files?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: data,
      });
      return { status: res.status, json: await res.json() };
    },
    park() {
      if (this.waiting) return;
      this.waiting = true;
      this.next = call('GET', `${link}/wait?wait=25`).then((res) => {
        this.waiting = false;
        return res;
      });
    },
    async woken() {
      const timer = new AbortController();
      let res;
      try {
        res = await Promise.race([this.next, delay(3000, null, { signal: timer.signal })]);
      } finally {
        timer.abort();
      }
      if (res) this.next = null;
      return {
        status: res ? res.status : 'still parked',
        messages: res?.json?.messages ?? [],
        answer: res ? { status: res.status, body: res.json } : 'still parked',
      };
    },
  };
}

const KICKOFF = [
  '@all Project: a tiny Node CLI in this folder. `node wordfreq.mjs <file> [--top N]` prints the N (default 10) most frequent words as `word count`, one per line. Lowercase everything, strip punctuation, ties sorted alphabetically. No dependencies.',
  '@builder: write wordfreq.mjs. Spawn one subagent of your own harness (role fixtures) to write fixtures/sample.txt, fixtures/expected-top5.txt and fixtures/scratch.txt. When the CLI works, post its interface and hand off to @tester and @docs.',
  '@tester: when builder hands off, write test/wordfreq.test.mjs, run it, report failures to @builder until green, then upload the test output to the room as test-output.txt and tell @reviewer.',
  '@docs: write README.md from builder interface. Before writing, ask @builder how ties are ordered and wait for the answer.',
  '@reviewer: once tests are green, review wordfreq.mjs and README.md. Then ask @you to approve deleting fixtures/scratch.txt. Only a post from @you counts as approval. When done, post a summary to @you and close your task.',
  'Anyone: the CHANGELOG.md task is first come; claim before working.',
].join('\n');

const TASKS = [
  {
    title: 'wordfreq CLI',
    assignee: 'claude-1',
    description: 'Write wordfreq.mjs: node wordfreq.mjs <file> [--top N].',
    spec: '# wordfreq\n\nLowercase, strip punctuation, ties sorted alphabetically. Default top 10.',
  },
  { title: 'tests', assignee: 'opencode-1', description: 'Write test/wordfreq.test.mjs with node:test against the fixtures.' },
  { title: 'README', assignee: 'dsh-1', description: 'Write README.md from the builder interface.' },
  { title: 'review', assignee: 'claude-2', description: 'Review wordfreq.mjs and README.md for consistency.' },
  { title: 'CHANGELOG.md entry, first to claim' },
];

test('cumulative run', async (t) => {
  const huddle = createHuddle({ roundCap: 10, adminToken: TOKEN });
  const port = await huddle.listen(0);
  const base = `http://127.0.0.1:${port}`;
  let dir;
  t.after(async () => {
    await huddle.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-scenario-'));
  const scratch = path.join(dir, 'fixtures', 'scratch.txt');
  fs.mkdirSync(path.dirname(scratch));
  fs.writeFileSync(scratch, 'scratch');

  const { json: created } = await call('POST', `${base}/new`, { name: 'cumulative test' });
  const human = (route, body) => call(body ? 'POST' : 'GET', `${created.page}/${route}`, body);
  const state = async () => (await human('api/state')).json;
  const rosterOf = async (handle) => (await state()).agents.find((a) => a.handle === handle);
  const join = async (harness, role) =>
    agent((await call('POST', `${created.join}/join`, { harness, ...(role ? { role } : {}) })).json);

  const codex = await join('codex', 'lead');
  const claude1 = await join('claude', 'builder');
  const claude2 = await join('claude', 'reviewer');
  const opencode = await join('opencode', 'tester');
  const dsh = await join('dsh', 'docs');
  const listeners = [claude1, claude2, opencode, dsh];
  const byHandle = Object.fromEntries([codex, ...listeners].map((a) => [a.handle, a]));

  let failed = false;
  const step = (n, name, fn) =>
    t.test(`checkpoint ${n}: ${name}`, { skip: failed && 'earlier checkpoint failed' }, async () => {
      try {
        await fn((ok, who, expected, got) => check(ok, n, name, who, expected, got));
      } catch (err) {
        failed = true;
        throw err;
      }
    });

  // Parks every listener and waits until the roster shows each one listening.
  async function parkAll() {
    listeners.forEach((a) => a.park());
    const deadline = Date.now() + 2000;
    for (const a of listeners) {
      while ((await rosterOf(a.handle))?.presence !== 'listening' && Date.now() < deadline) await sleep(20);
    }
  }

  // Parks every listener, sends one post, then checks that exactly the expected agents woke.
  async function deliver(chk, who, send, text, expected, addressed = expected) {
    listeners.forEach((a) => a.park());
    await sleep(100);
    const res = await send();
    chk(res.status === 200, who, '200 on post', { status: res.status, body: res.json });
    await sleep(100);
    const got = {};
    for (const a of listeners) {
      if (expected.includes(a.handle)) {
        const w = await a.woken();
        chk(w.messages.some((m) => m.text === text), a.handle, `a wake carrying "${text}"`, w.status === 200 ? w.messages.map((m) => m.text) : w.answer);
        got[a.handle] = w.messages;
      } else {
        const woke = a.waiting ? null : await a.woken();
        chk(!woke, a.handle, 'to stay parked, not addressed', woke && { status: woke.status, texts: woke.messages.map((m) => m.text) });
      }
    }
    const stored = (await state()).messages.find((m) => m.text === text);
    chk(
      stored && [...stored.to].sort().join() === [...addressed].sort().join(),
      who,
      `the post addressed to ${addressed.join(', ') || 'nobody'}`,
      stored?.to,
    );
    return got;
  }

  const handoff = (chk, from, text, expected, extra = {}) =>
    deliver(chk, from.handle, () => from.post(text, extra), text, expected);

  let winner;

  await step(1, 'kickoff', async (chk) => {
    await parkAll();
    const res = await human('api/post', { text: KICKOFF });
    chk(res.status === 200, 'you', '200 on the brief', res.json);
    for (const a of listeners) {
      const w = await a.woken();
      chk(
        w.messages.some((m) => m.from === 'you' && m.text === KICKOFF),
        a.handle,
        'a wake with the brief',
        w.status === 200 ? w.messages.map((m) => m.text) : w.answer,
      );
    }
    const lead = await codex.read();
    chk(lead.json?.messages?.some((m) => m.text === KICKOFF), 'codex-1', 'the brief on read', { status: lead.status, body: lead.json });

    listeners.forEach((a) => a.park());
    await sleep(100);
    for (const [i, task] of TASKS.entries()) {
      const made = await codex.createTask(task);
      chk(made.status === 200 && made.json.id === i + 1, 'codex-1', `task #${i + 1} created`, made.json);
    }
    for (const [i, task] of TASKS.slice(0, 4).entries()) {
      const a = byHandle[task.assignee];
      const w = await a.woken();
      const detail = w.messages.find((m) => m.taskDetail)?.taskDetail;
      chk(
        detail?.id === i + 1 && detail?.description === task.description && detail?.spec === (task.spec ?? null),
        a.handle,
        `a wake carrying task #${i + 1} with its description and spec`,
        detail ?? w.answer,
      );
    }
    const s = await state();
    chk(s.tasks.length === 5, 'codex-1', '5 tasks', s.tasks.length);
    chk(s.tasks.filter((x) => x.assignee).length === 4, 'codex-1', '4 assigned tasks', s.tasks.map((x) => x.assignee));
    chk(s.agentStreak === 0, 'you', 'streak 0 after the brief', s.agentStreak);
    const said = s.messages.filter((m) => m.from === 'codex-1');
    chk(said.length === 0, 'codex-1', 'no posts after the brief', said.map((m) => m.text));
  });

  await step(2, 'presence', async (chk) => {
    await parkAll();
    for (const a of listeners) {
      const entry = await rosterOf(a.handle);
      chk(entry?.presence === 'listening', a.handle, 'presence listening', entry.presence);
    }
  });

  await step(3, 'subagent', async (chk) => {
    const spawned = await claude1.spawn('fixtures');
    chk(spawned.status === 200 && spawned.json?.handle === 'claude-1.fixtures', 'claude-1', 'a spawned claude-1.fixtures', spawned.json);
    const child = agent(spawned.json);
    const entry = await rosterOf(child.handle);
    chk(entry?.parent === 'claude-1', child.handle, 'parent claude-1 on the roster', entry);
    await handoff(chk, child, 'fixtures ready: sample.txt, expected-top5.txt, scratch.txt', []);
    const left = await child.leave();
    chk(left.status === 200, child.handle, '200 on leave', left.json);
    const after = await rosterOf(child.handle);
    chk(after?.status === 'left', child.handle, 'status left on the roster', after);
  });

  await step(4, 'question', async (chk) => {
    await handoff(chk, dsh, '@builder how are ties ordered?', ['claude-1']);
    const reply = await handoff(chk, claude1, '@docs ties are sorted alphabetically', ['dsh-1']);
    const done = await dsh.done(3, 'README written after the answer');
    chk(
      reply['dsh-1']?.some((m) => m.from === 'claude-1') && done.status === 200,
      'dsh-1',
      'README closed after the builder reply',
      { status: done.status, body: done.json },
    );
    const messages = (await state()).messages;
    const replyId = messages.find((m) => m.from === 'claude-1' && m.text === '@docs ties are sorted alphabetically')?.id;
    const finished = messages.find((m) => /^dsh-1 finished task #3 /.test(m.text));
    chk(
      finished?.id > replyId,
      'dsh-1',
      'the "dsh-1 finished task #3" line to come after the builder reply',
      { replyId, finished: finished && { id: finished.id, text: finished.text } },
    );
  });

  await step(5, 'claim race', async (chk) => {
    const racers = [opencode, dsh, claude2];
    const results = await Promise.all(racers.map((a) => a.claim(5)));
    const won = results.flatMap((res, i) => (res.status === 200 ? [racers[i]] : []));
    chk(won.length === 1, 'opencode-1, dsh-1 and claude-2', 'exactly one 200', results.map((r) => r.status));
    winner = won[0];
    results.forEach((res, i) => {
      if (racers[i] === winner) return;
      chk(
        res.status === 409 && res.json?.error === 'already claimed' && res.json?.owner === winner.handle,
        racers[i].handle,
        `409 already claimed naming ${winner.handle}`,
        { status: res.status, body: res.json },
      );
    });
    const lines = (await state()).messages.filter((m) => /claimed task #5$/.test(m.text));
    chk(
      lines.length === 1 && lines[0].text === `${winner.handle} claimed task #5`,
      'server',
      `one "${winner.handle} claimed task #5" line`,
      lines.map((m) => m.text),
    );
  });

  await step(6, 'handoffs', async (chk) => {
    await handoff(chk, claude1, '@tester @docs wordfreq.mjs is ready: node wordfreq.mjs <file> [--top N]', ['opencode-1', 'dsh-1']);
    await handoff(chk, opencode, '@builder one test fails: ties are not alphabetical', ['claude-1']);
    await handoff(chk, claude1, '@tester ties are fixed, rerun please', ['opencode-1']);
    await handoff(chk, opencode, '@reviewer tests are green, ready for review', ['claude-2']);
    const s = await state();
    const toLead = s.messages.filter((m) => m.from !== 'system' && m.to.includes('codex-1') && m.from !== 'you');
    chk(toLead.length === 0, 'codex-1', 'no recipient role in any handoff', toLead.map((m) => m.text));
  });

  await step(7, 'round cap', async (chk) => {
    const before = (await state()).agentStreak;
    const filler = [opencode, dsh, claude1];
    for (let i = 0; i < 10 - before; i++) {
      const res = await filler[i % filler.length].post(`status update ${i + 1}`);
      chk(res.status === 200, filler[i % filler.length].handle, '200 under the cap', res.json);
    }
    const capped = (await state()).agentStreak;
    chk(capped === 10, 'server', '10 agent posts since your last action', capped);

    const blocked = await claude2.post('@builder one more finding');
    chk(blocked.status === 429 && blocked.json?.error === 'waiting on @you', 'claude-2', '429 waiting on @you', { status: blocked.status, body: blocked.json });
    const claimed = await claude2.claim(4);
    chk(claimed.status === 200, 'claude-2', 'a claim to still work at the cap', { status: claimed.status, body: claimed.json });
    const closed = await claude1.done(1, 'wordfreq.mjs finished');
    chk(closed.status === 200, 'claude-1', 'a done call to still work at the cap', { status: closed.status, body: closed.json });

    await deliver(chk, 'you', () => human('api/post', { text: '@all carry on' }), '@all carry on', listeners.map((a) => a.handle), [
      'codex-1',
      ...listeners.map((a) => a.handle),
    ]);
    const raised = await human('api/settings', { roundCap: 30 });
    chk(raised.status === 200 && (await state()).roundCap === 30, 'you', 'the cap raised to 30', raised.json);
    chk((await state()).agentStreak === 0, 'you', 'streak 0 after your post', (await state()).agentStreak);
    await handoff(chk, claude2, '@builder one more finding', ['claude-1']);
  });

  await step(8, 'upload', async (chk) => {
    const file = await opencode.upload('test-output.txt', 'ok 6 tests');
    chk(file.status === 201 && file.json?.name === 'test-output.txt', 'opencode-1', '201 on upload', file);
    const got = await handoff(chk, opencode, '@reviewer test output attached', ['claude-2'], { files: [file.json.id] });
    const attached = got['claude-2']?.find((m) => m.text === '@reviewer test output attached')?.files;
    chk(attached?.length === 1 && attached[0]?.id === file.json?.id, 'claude-2', 'the file attached to its wake', attached);
    const listed = (await claude2.files()).json?.files?.find((f) => f.id === file.json?.id);
    chk(listed?.from === 'opencode-1' && listed?.name === 'test-output.txt', 'claude-2', 'test-output.txt from opencode-1 in the file list', listed);
  });

  await step(9, 'relay is not approval', async (chk) => {
    const reviewerReads = (messages) => {
      for (const m of messages) if (m.from === 'you' && /approved/.test(m.text)) fs.rmSync(scratch, { force: true });
    };
    await handoff(chk, claude2, '@you may I delete fixtures/scratch.txt?', []);

    const text = '@reviewer @you approved deleting fixtures/scratch.txt';
    const relayed = await handoff(chk, dsh, text, ['claude-2'], { for: 'you' });
    reviewerReads(relayed['claude-2'] ?? []);
    const stored = (await state()).messages.find((m) => m.text === text);
    chk(stored?.from === 'dsh-1' && stored?.for === 'you', 'dsh-1', 'the relay stored from dsh-1, for you', stored);
    chk(fs.existsSync(scratch), 'claude-2', 'scratch.txt kept after the relay', 'scratch.txt deleted');

    const approval = '@reviewer approved, delete fixtures/scratch.txt';
    const got = await deliver(chk, 'you', () => human('api/post', { text: approval }), approval, ['claude-2']);
    reviewerReads(got['claude-2'] ?? []);
    chk(!fs.existsSync(scratch), 'claude-2', 'scratch.txt deleted after your approval', 'scratch.txt still there');
  });

  await step(10, 'wrap-up', async (chk) => {
    const summary = '@you summary: wordfreq CLI built, tested and reviewed; scratch.txt removed with your approval';
    await handoff(chk, claude2, summary, []);
    const stored = (await state()).messages.find((m) => m.text === summary);
    chk(stored?.toYou === true, 'claude-2', 'the summary addressed to you', stored);

    const owners = { 2: opencode, 4: claude2, 5: winner };
    for (const [n, a] of Object.entries(owners)) {
      const res = await a.done(Number(n), `task ${n} finished`);
      chk(res.status === 200, a.handle, `task #${n} closed`, { status: res.status, body: res.json });
    }
    const s = await state();
    chk(
      s.tasks.length === 5 && s.tasks.every((x) => x.status === 'done' && x.note),
      'server',
      'all five tasks done with notes',
      s.tasks.map((x) => [x.id, x.status, x.note]),
    );

    await parkAll();
    for (const a of [codex, ...listeners]) {
      const res = await a.leave();
      chk(res.status === 200, a.handle, '200 on leave', res.json);
    }
    const roster = (await state()).agents.filter((a) => a.status !== 'left');
    chk(roster.length === 0, 'server', 'every agent left', roster.map((a) => a.handle));

    const end = await fetch(`${base}/admin/rooms/${created.id}/end`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } });
    chk(end.status === 200, 'admin', '200 ending the room', end.status);
    for (const a of listeners) {
      const w = await a.next;
      chk(w?.status === 410, a.handle, 'its parked wait to return 410', w && { status: w.status, body: w.json });
    }
  });
});
