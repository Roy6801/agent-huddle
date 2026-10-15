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
  const state = async () => (await fetch(`${created.page}/api/state`)).json();
  const check = async (handle) => (await state()).agents.find((a) => a.handle === handle);
  return { join, state, check };
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
    assert.deepEqual(await check(r.handle), { ...(await check(r.handle)), folder, folderCheck: 'inside' });
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
