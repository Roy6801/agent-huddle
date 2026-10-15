import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

const post = (url, body) => fetch(url, { method: 'POST', body: JSON.stringify(body) });

async function room(body = {}) {
  const huddle = createHuddle({ adminToken: 'admin' });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = await (await post(`http://127.0.0.1:${port}/new`, { name: 'folders', ...body })).json();
  const join = async (b) => (await post(`${created.join}/join`, { harness: 'codex', ...b })).json();
  const settings = async (body) => {
    const res = await post(`${created.page}/api/settings`, body);
    return { status: res.status, json: await res.json() };
  };
  const state = async () => (await fetch(`${created.page}/api/state`)).json();
  const check = async (handle) => (await state()).agents.find((a) => a.handle === handle);
  return { join, state, check, settings, created };
}

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-folder-')));
const folderNotes = (st) => st.messages.filter((m) => m.toYou && /room folder/.test(m.text));

test('AC-70: inside, a subfolder and a symlink to the room folder are fine; a look-alike sibling is outside', async () => {
  const dir = tmp();
  const sub = path.join(dir, 'pkg');
  fs.mkdirSync(sub);
  const dots = path.join(dir, '..odd');
  fs.mkdirSync(dots);
  const link = `${dir}-link`;
  fs.symlinkSync(dir, link);
  const { join, state, check } = await room({ folder: dir });
  for (const folder of [dir, sub, dots, link]) {
    const r = await join({ folder });
    assert.equal(r.warning, undefined);
    const agent = await check(r.handle);
    assert.equal(agent.folder, folder);
    assert.equal(agent.folderCheck, 'inside');
  }
  const sibling = await join({ folder: `${dir}-old` });
  assert.equal((await check(sibling.handle)).folderCheck, 'outside');
  assert.equal(folderNotes(await state()).length, 1);
});

test('AC-71: an outside join gets a warning and tells @you once', async () => {
  const dir = tmp();
  const elsewhere = tmp();
  const { join, state, check } = await room({ folder: dir });
  const r = await join({ folder: elsewhere });
  assert.ok(r.warning.includes(dir));
  assert.match(r.warning, /full paths/);
  assert.match(r.warning, /ask @you once/);
  const notes = folderNotes(await state());
  assert.equal(notes.length, 1);
  for (const part of [r.handle, elsewhere, dir]) assert.ok(notes[0].text.includes(part));
  assert.equal((await check(r.handle)).folderCheck, 'outside');
});

test('unreported and folderless rooms get no warning', async () => {
  const withFolder = await room({ folder: tmp() });
  const a = await withFolder.join({});
  assert.equal(a.warning, undefined);
  assert.equal((await withFolder.check(a.handle)).folderCheck, 'unreported');

  const none = await room();
  const b = await none.join({ folder: tmp() });
  assert.equal(b.warning, undefined);
  assert.equal((await none.check(b.handle)).folderCheck, null);
  assert.equal(folderNotes(await none.state()).length, 0);
});

test('a relative reported folder is rejected', async () => {
  const { join } = await room({ folder: tmp() });
  const r = await join({ folder: 'relative/path' });
  assert.equal(r.error, 'invalid_folder');
});

test('a spawned child inherits its parent folder', async () => {
  const dir = tmp();
  const { join, check } = await room({ folder: dir });
  const parent = await join({ folder: dir });
  const child = await (await post(`${parent.link}/spawn`, { role: 'helper' })).json();
  assert.equal((await check(child.handle)).folder, dir);
});

const notes = (st, re) => st.messages.filter((m) => m.kind === 'system' && re.test(m.text));

test('AC-72: moving the folder tells every live agent, tasks the lead, and re-checks the roster', async () => {
  const a = tmp();
  const b = tmp();
  const { join, state, check, settings, created } = await room({ folder: a });
  const lead = await join({ folder: a, lead: created.lead });
  const inA = await join({ folder: a });
  const inB = await join({ folder: b });
  assert.equal((await check(inB.handle)).folderCheck, 'outside');

  const res = await settings({ folder: b });
  assert.equal(res.status, 200);
  assert.equal(res.json.folder, b);
  const st = await state();
  assert.equal(st.folder, b);
  const moved = notes(st, /moved the room folder/);
  assert.equal(moved.length, 1);
  assert.ok(moved[0].text.includes(a) && moved[0].text.includes(b));
  for (const h of [lead.handle, inA.handle, inB.handle]) assert.ok(moved[0].to.includes(h));
  assert.equal(st.tasks.length, 1);
  assert.equal(st.tasks[0].createdBy, 'you');
  assert.equal(st.tasks[0].assignee, lead.handle);
  assert.ok(st.tasks[0].description.includes(a) && st.tasks[0].description.includes(b));
  assert.equal((await check(inA.handle)).folderCheck, 'outside');
  assert.equal((await check(inB.handle)).folderCheck, 'inside');
  assert.equal((await join({})).folder, b);

  const again = await settings({ folder: b });
  assert.equal(again.status, 200);
  const after = await state();
  assert.equal(notes(after, /moved the room folder/).length, 1);
  assert.equal(after.tasks.length, 1);
});

test('AC-72: setting a first folder posts the notice and creates no task', async () => {
  const dir = tmp();
  const { join, state, settings } = await room();
  const x = await join({});
  assert.equal((await settings({ folder: dir })).status, 200);
  const st = await state();
  const set = notes(st, /you set the room folder/);
  assert.equal(set.length, 1);
  assert.ok(set[0].text.includes(dir) && set[0].to.includes(x.handle));
  assert.equal(st.tasks.length, 0);
});

test('AC-73: a missing or relative folder is refused and nothing changes', async () => {
  const dir = tmp();
  const { state, settings } = await room({ folder: dir });
  const before = await state();
  for (const [folder, error] of [[`${dir}-tset`, 'folder_not_found'], ['huddle-test', 'invalid_folder'], [null, 'invalid_folder']]) {
    const res = await settings({ folder, roundCap: 7 });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, error);
  }
  const st = await state();
  assert.equal(st.folder, dir);
  assert.equal(st.roundCap, before.roundCap);
  assert.equal(st.messages.length, before.messages.length);
  assert.equal(st.tasks.length, before.tasks.length);
});

test('a reported folder spelled with a symlink, a .. segment or a missing subfolder is inside', async () => {
  const dir = tmp();
  const sub = path.join(dir, 'pkg');
  fs.mkdirSync(sub);
  const link = `${dir}-alias`;
  fs.symlinkSync(dir, link);
  const spelled = path.join(os.tmpdir(), path.basename(dir));
  const { join, check } = await room({ folder: dir });
  for (const folder of [path.join(link, 'pkg'), `${sub}/../pkg`, path.join(dir, 'new', 'deep'), path.join(link, 'new', 'deep'), spelled, path.join(spelled, 'new', 'deep')]) {
    const r = await join({ folder });
    assert.equal((await check(r.handle)).folderCheck, 'inside', folder);
  }
  const roomViaLink = await room({ folder: link });
  const r = await roomViaLink.join({ folder: path.join(dir, 'new', 'deep') });
  assert.equal((await roomViaLink.check(r.handle)).folderCheck, 'inside');
});

test('settings with the same folder and a trailing slash change nothing', async () => {
  const dir = tmp();
  const { join, state, settings } = await room({ folder: dir });
  await join({ folder: dir });
  const before = await state();
  const res = await settings({ folder: `${dir}/` });
  assert.equal(res.status, 200);
  const st = await state();
  assert.equal(st.folder, dir);
  assert.equal(st.messages.length, before.messages.length);
  assert.equal(st.tasks.length, 0);
});

test('a very long old and new folder pair still creates the move task', async () => {
  const long = (root) => {
    let p = root;
    for (let i = 0; i < 8; i++) p = path.join(p, 'd'.repeat(100));
    fs.mkdirSync(p, { recursive: true });
    return p;
  };
  const a = long(tmp());
  const b = long(tmp());
  const { join, state, settings, created } = await room({ folder: a });
  const lead = await join({ folder: a, lead: created.lead });
  await join({ folder: a });
  assert.equal((await settings({ folder: b })).status, 200);
  const st = await state();
  assert.equal(st.folder, b);
  assert.equal(st.tasks.length, 1);
  assert.equal(st.tasks[0].assignee, lead.handle);
  assert.ok(st.tasks[0].description.length <= 2000);
});

test('AC-23.7: changing the folder before other agents join or any task creates no move task and shifts no task numbers', async () => {
  const a = tmp();
  const b = tmp();
  const c = tmp();
  const { join, state, settings, created } = await room({ folder: a });
  assert.equal((await settings({ folder: b })).status, 200);
  const lead = await join({ folder: a, lead: created.lead });
  assert.equal((await settings({ folder: c })).status, 200);
  let st = await state();
  assert.equal(st.folder, c);
  assert.equal(st.tasks.length, 0);
  assert.equal(notes(st, /moved the room folder/).length, 0);
  const set = notes(st, /you set the room folder to/);
  assert.equal(set.length, 2);
  assert.ok(set[1].to.includes(lead.handle));
  assert.equal((await join({ folder: c })).folder, c);

  const task = await (await post(`${lead.link}/tasks`, { title: 'first' })).json();
  assert.equal(task.id, 1);
  assert.equal((await settings({ folder: a })).status, 200);
  st = await state();
  assert.equal(notes(st, /moved the room folder/).length, 1);
  assert.equal(st.tasks.length, 2);
});

test('AC-23.6: the new reply names the room folder and asks to confirm it before agents join', async () => {
  const dir = tmp();
  const { created } = await room({ folder: dir });
  assert.equal(created.folder, dir);
  const blocks = created.announce.split('\n\n');
  assert.equal(blocks[2], `Room folder: ${dir}. Every agent works there. Confirm it before you bring in agents; if it is wrong, change Room folder in the page's settings now, before agents join.`);
  const none = await room();
  assert.equal(none.created.folder, null);
  assert.match(none.created.announce, /No room folder is set\. Set Room folder in the page's settings before you bring in agents\./);
});
