import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHuddle, addWorktree, worktreeCleanup } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const tmp = (prefix = 'huddle-wt-') => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

function repo({ commit = true } = {}) {
  const dir = tmp('huddle-repo-');
  git(dir, 'init', '-q', '-b', 'main');
  if (commit) {
    fs.writeFileSync(path.join(dir, 'README.md'), 'hello\n');
    fs.mkdirSync(path.join(dir, 'app'));
    fs.writeFileSync(path.join(dir, 'app', 'main.js'), '\n');
    git(dir, 'add', '.');
    git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init');
  }
  return dir;
}

const worktreeCount = (dir) => git(dir, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length;
const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

async function room(body = {}) {
  const worktreeDir = tmp('huddle-wts-');
  const huddle = createHuddle({ adminToken: 'admin', worktreeDir });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const created = await (await post(`${base}/new`, { name: 'trees', ...body })).json();
  const id8 = created.join.split('/s/')[1].slice(0, 8);
  const join = async (b = {}) => (await post(`${created.join}/join`, { harness: 'codex', ...b })).json();
  const settings = async (b) => {
    const res = await post(`${created.page}/api/settings`, b);
    return { status: res.status, json: await res.json() };
  };
  const state = async () => (await fetch(`${created.page}/api/state`)).json();
  const end = async () => (await post(`${base}/admin/rooms/${created.join.split('/s/')[1]}/end`, {}, { authorization: 'Bearer admin' })).json();
  return { join, settings, state, end, created, id8, worktreeDir };
}

test('AC-36.1: worktrees are refused without a room folder, outside a git repo, or with a bad value', async () => {
  const none = await room();
  const a = await none.settings({ worktrees: 'per-agent' });
  assert.equal(a.status, 400);
  assert.equal(a.json.error, 'worktrees_need_folder');

  const plain = tmp();
  const r = await room({ folder: plain });
  const b = await r.settings({ worktrees: 'per-agent' });
  assert.equal(b.status, 400);
  assert.equal(b.json.error, 'worktrees_need_git');
  assert.ok(b.json.message.includes(plain));
  assert.equal((await r.settings({ worktrees: 'yes' })).json.error, 'invalid_worktrees');
  assert.equal((await r.state()).worktrees, 'off');
});

test('AC-36.2: with worktrees off a join creates no worktree or branch', async () => {
  const dir = repo();
  const r = await room({ folder: dir });
  const a = await r.join({ folder: dir });
  assert.equal(a.worktree, undefined);
  assert.equal(worktreeCount(dir), 1);
  assert.equal(git(dir, 'branch', '--list', 'huddle/*'), '');
});

test('AC-36.3/4/5: each agent that joins gets its own worktree on its own branch, named in its protocol and the roster', async () => {
  const dir = repo();
  const head = git(dir, 'rev-parse', 'HEAD');
  const r = await room({ folder: dir });
  const on = await r.settings({ worktrees: 'per-agent' });
  assert.equal(on.status, 200);
  assert.equal(on.json.worktrees, 'per-agent');
  const st0 = await r.state();
  assert.equal(st0.worktrees, 'per-agent');
  assert.ok(st0.messages.some((m) => m.from === 'system' && m.text.includes('worktree per agent')));

  const one = await r.join({ folder: dir });
  const two = await r.join({ folder: dir });
  for (const a of [one, two]) {
    assert.equal(a.worktree.path, path.join(r.worktreeDir, r.id8, a.handle));
    assert.equal(a.worktree.branch, `huddle/${r.id8}/${a.handle}`);
    assert.equal(a.worktree.base, head);
    assert.equal(git(a.worktree.path, 'rev-parse', '--abbrev-ref', 'HEAD'), a.worktree.branch);
    assert.equal(a.warning, undefined);
  }
  assert.notEqual(one.worktree.path, two.worktree.path);
  assert.equal(worktreeCount(dir), 3);

  fs.writeFileSync(path.join(one.worktree.path, 'only-one.txt'), 'x');
  assert.ok(!fs.existsSync(path.join(two.worktree.path, 'only-one.txt')));
  assert.ok(!fs.existsSync(path.join(dir, 'only-one.txt')));

  const protocol = await (await fetch(one.link)).text();
  assert.ok(protocol.includes(`Your worktree: ${one.worktree.path} on branch ${one.worktree.branch}`));
  assert.match(protocol, /Say in your done note which branch has the work/);
  assert.match(protocol, /only with @you's OK/);
  const me = await (await fetch(`${one.link}/me`)).json();
  assert.deepEqual(me.worktree, one.worktree);
  assert.equal(me.worktrees, 'per-agent');

  const st = await r.state();
  const row = st.agents.find((a) => a.handle === one.handle);
  assert.deepEqual(row.worktree, one.worktree);
  assert.equal(row.folderCheck, 'inside');
});

test('a room folder below the repo root maps to the same subfolder in each worktree', async () => {
  const dir = repo();
  const r = await room({ folder: path.join(dir, 'app') });
  await r.settings({ worktrees: 'per-agent' });
  const a = await r.join({ folder: path.join(dir, 'app') });
  assert.equal(a.worktree.path, path.join(r.worktreeDir, r.id8, a.handle, 'app'));
  assert.ok(fs.existsSync(path.join(a.worktree.path, 'main.js')));
});

test('AC-36.5: a join from inside one of the room worktrees counts as inside the room folder', async () => {
  const dir = repo();
  const r = await room({ folder: dir });
  await r.settings({ worktrees: 'per-agent' });
  const a = await r.join({ folder: dir });
  await r.settings({ worktrees: 'off' });
  const b = await r.join({ folder: a.worktree.path });
  assert.equal(b.warning, undefined);
  assert.equal(b.worktree, undefined);
  assert.equal((await r.state()).agents.find((x) => x.handle === b.handle).folderCheck, 'inside');
});

test('AC-36.6: leaving and rejoining keeps the worktree; adding an existing worktree again reuses it', async () => {
  const dir = repo();
  const r = await room({ folder: dir });
  await r.settings({ worktrees: 'per-agent' });
  const a = await r.join({ folder: dir });
  await post(`${a.link}/leave`, {});
  const me = await (await fetch(`${a.link}/me`)).json();
  assert.equal(me.status, 'active');
  assert.deepEqual(me.worktree, a.worktree);
  assert.equal(worktreeCount(dir), 2);

  const again = await addWorktree(dir, a.worktree.path, a.worktree.branch);
  assert.equal(again.base, a.worktree.base);
  assert.equal(worktreeCount(dir), 2);

  const elsewhere = path.join(r.worktreeDir, 'reused');
  git(dir, 'branch', 'huddle/x/old');
  await addWorktree(dir, elsewhere, 'huddle/x/old');
  assert.equal(git(elsewhere, 'rev-parse', '--abbrev-ref', 'HEAD'), 'huddle/x/old');
  await assert.rejects(addWorktree(dir, tmp(), 'huddle/x/other'), /not a worktree on huddle\/x\/other/);
});

test('a spawned agent shares its parent worktree', async () => {
  const dir = repo();
  const r = await room({ folder: dir });
  await r.settings({ worktrees: 'per-agent' });
  const a = await r.join({ folder: dir });
  const child = await (await post(`${a.link}/spawn`, { role: 'tester' })).json();
  assert.deepEqual(child.worktree, a.worktree);
  assert.equal(worktreeCount(dir), 2);
});

test('when git cannot make the worktree the agent still joins, in the room folder, and @you is told', async () => {
  const dir = repo({ commit: false });
  const r = await room({ folder: dir });
  assert.equal((await r.settings({ worktrees: 'per-agent' })).status, 200);
  const a = await r.join({ folder: dir });
  assert.equal(a.worktree, undefined);
  assert.match(a.warning, /could not be made/);
  assert.ok(a.warning.includes(dir));
  assert.ok((await r.state()).messages.some((m) => m.toYou && m.text.includes(`${a.handle} has no worktree`)));
});

test('with worktrees on, moving the room folder outside git is refused', async () => {
  const dir = repo();
  const r = await room({ folder: dir });
  await r.settings({ worktrees: 'per-agent' });
  const moved = await r.settings({ folder: tmp() });
  assert.equal(moved.status, 400);
  assert.equal(moved.json.error, 'worktrees_need_git');
  assert.match(moved.json.instruction, /Turn worktrees off first/);
  assert.equal((await r.state()).folder, dir);
});

test('AC-36.7: ending the room keeps every worktree and branch and lists how to remove them', async () => {
  const dir = repo();
  const r = await room({ folder: dir });
  await r.settings({ worktrees: 'per-agent' });
  const a = await r.join({ folder: dir });
  await post(`${a.link}/spawn`, { role: 'tester' });
  fs.writeFileSync(path.join(a.worktree.path, 'work.txt'), 'unmerged');
  git(a.worktree.path, 'add', '.');
  git(a.worktree.path, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'work');

  const ended = await r.end();
  assert.equal(ended.ended, true);
  assert.deepEqual(ended.worktrees, [{ handle: a.handle, path: path.join(r.worktreeDir, r.id8, a.handle), branch: a.worktree.branch, repo: dir }]);
  assert.ok(fs.existsSync(path.join(a.worktree.path, 'work.txt')));
  assert.equal(worktreeCount(dir), 2);
  assert.equal(git(dir, 'branch', '--list', a.worktree.branch).replace(/^[*+ ]+/, ''), a.worktree.branch);

  const text = worktreeCleanup(ended.worktrees);
  assert.ok(text.includes(`git -C ${dir} worktree remove ${ended.worktrees[0].path} && git -C ${dir} branch -d ${a.worktree.branch}`));
});
