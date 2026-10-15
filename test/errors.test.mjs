import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createHuddle, ERRORS } from '../skills/agent-huddle/huddle.mjs';

const THREE = ['error', 'message', 'instruction'];
const OPTIONS = [
  { optionId: 'yes', kind: 'allow_once', name: 'Yes' },
  { optionId: 'no', kind: 'reject_once', name: 'No' },
];

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function call(method, url, body, headers = {}) {
  const plain = typeof body === 'string';
  const res = await fetch(url, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined || plain ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}

// Raw request so a Host header can be forged and an early 413 read without client errors.
function raw(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: { connection: 'close', ...headers } }, (res) => {
      let text = '';
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(text) }));
    });
    req.on('error', (err) => (err.code === 'ECONNRESET' || err.code === 'EPIPE' ? undefined : reject(err)));
    req.end(body);
  });
}

async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'admin', ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const { json: created } = await call('POST', `${base}/new`, { name: 'errors' });
  const join = async (harness) => (await call('POST', `${created.join}/join`, { harness })).json;
  const human = (path, body) => call(body ? 'POST' : 'GET', `${created.page}/${path}`, body);
  return { base, port, created, join, human };
}

const shaped = (res, status, error) => {
  assert.equal(res.status, status, JSON.stringify(res.json));
  assert.equal(res.json.error, error);
  assert.deepEqual(Object.keys(res.json), THREE);
};

test('AC-40: a refused post names the round cap, @you and the next step', async () => {
  const r = await room({ roundCap: 1 });
  const a = await r.join('codex');
  assert.equal((await call('POST', `${a.link}/post`, { text: 'one' })).status, 200);
  const res = await call('POST', `${a.link}/post`, { text: 'two' });
  shaped(res, 429, 'round_cap');
  assert.match(res.json.message, /round cap of 1 /);
  assert.match(res.json.message, /@you/);
  assert.match(res.json.instruction, /@you/);
});

test('AC-41: already_claimed carries the owner handle in its text, not as a field', async () => {
  const r = await room();
  const a = await r.join('codex');
  const b = await r.join('claude');
  await call('POST', `${a.link}/tasks`, { title: 'wordfreq' });
  assert.equal((await call('POST', `${a.link}/tasks/1/claim`)).status, 200);
  const res = await call('POST', `${b.link}/tasks/1/claim`);
  shaped(res, 409, 'already_claimed');
  assert.match(res.json.message, /@codex-1/);
  assert.match(res.json.instruction, /@codex-1/);
});

test('AC-42: errors sharing a status have distinct codes, and every code is in the table', async () => {
  const r = await room();
  const a = await r.join('codex');
  const b = await r.join('claude');
  await call('POST', `${a.link}/tasks`, { title: 'one' });
  await call('POST', `${a.link}/tasks`, { title: 'two' });
  await call('POST', `${a.link}/tasks/1/done`);
  await call('POST', `${a.link}/tasks/2/claim`);
  await call('POST', `${a.link}/asks`, { title: 'deploy?', options: OPTIONS });
  await r.human('api/asks/1', { optionId: 'yes' });

  const done = await call('POST', `${b.link}/tasks/1/claim`);
  const owned = await call('POST', `${b.link}/tasks/2/release`);
  const closed = await r.human('api/asks/1', { optionId: 'no' });
  shaped(done, 409, 'task_done');
  shaped(owned, 409, 'not_owner');
  shaped(closed, 409, 'ask_closed');

  const notLead = await call('POST', `${b.link}/brief`, { text: 'mine' });
  shaped(notLead, 403, 'not_lead');

  const missing = await r.human('api/settings', { folder: '/no/such/folder-errors' });
  shaped(missing, 400, 'folder_not_found');
  assert.match(missing.json.message, /\/no\/such\/folder-errors/);
  assert.match(missing.json.instruction, /unchanged/);

  const src = fs.readFileSync(new URL('../skills/agent-huddle/huddle.mjs', import.meta.url), 'utf8');
  const used = new Set([...src.matchAll(/(?:new HttpError|sendError|errorBody)\(\s*(?:[\w.]+,\s*)?'([a-z_]+)'/g)].map((m) => m[1]));
  for (const code of used) assert.ok(code in ERRORS, code);
  for (const [code, [status]] of Object.entries(ERRORS)) {
    assert.match(code, /^[a-z]+(_[a-z]+)*$/);
    if (status !== null) assert.ok(used.has(code), `${code} is never sent`);
  }
});

test('AC-43: chip lists keep valid next to the three fields', async () => {
  const r = await room();
  const a = await r.join('codex');
  const checks = [
    [await call('POST', `${a.link}/post`, { text: '@nobody hi' }), 'unknown_mention'],
    [await call('POST', `${a.link}/tasks`, { title: 't', assignee: 'nobody' }), 'unknown_assignee'],
    [await call('POST', `${a.link}/tasks`, { title: 't', specFile: 'nope' }), 'unknown_file'],
  ];
  for (const [res, code] of checks) {
    assert.equal(res.status, 400);
    assert.equal(res.json.error, code);
    assert.deepEqual(Object.keys(res.json), [...THREE, 'valid']);
    assert.ok(Array.isArray(res.json.valid), code);
  }
});

test('AC-44: other errors have exactly three fields with the specifics in the text', async () => {
  const r = await room({ maxFileBytes: 10 * 1024 * 1024 });
  const a = await r.join('codex');
  // Declared only: the server answers from the header, so no body races the early close.
  const big = await raw(r.port, `${new URL(a.link).pathname}/files?name=big.bin`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'content-length': String(11 * 1024 * 1024) },
  });
  shaped(big, 413, 'file_too_large');
  assert.match(big.json.message, /11 MB, over the 10 MB limit/);

  const kind = await call('POST', `${a.link}/asks`, { title: 'x', options: [{ ...OPTIONS[0], kind: 'maybe' }] });
  shaped(kind, 400, 'unknown_kind');
  assert.match(kind.json.instruction, /allow_once, allow_always, reject_once, reject_always/);

  await call('POST', `${a.link}/asks`, { title: 'deploy?', options: OPTIONS });
  const option = await r.human('api/asks/1', { optionId: 'maybe' });
  shaped(option, 400, 'unknown_option');
  assert.match(option.json.instruction, /yes, no/);
});

test('AC-45: routing and transport errors keep their status and the same shape', async () => {
  const r = await room();
  const a = await r.join('codex');
  const roomPath = new URL(r.created.join).pathname;
  const cases = [
    [await call('GET', `${r.created.join}/as/nope/read`), 401],
    [await raw(r.port, roomPath, { headers: { host: 'evil.example' } }), 403],
    [await raw(r.port, '/health', { headers: { origin: 'http://evil.example' } }), 403],
    [await call('GET', `${r.base}/s/nope`), 404],
    [await call('GET', `${a.link}/nope`), 404],
    [await call('POST', `${a.link}/post`, '{nope'), 400],
    [await call('POST', `${a.link}/post`, { text: 'x'.repeat(70 * 1024) }), 413],
  ];
  await call('POST', `${r.base}/admin/rooms/${r.created.id}/end`, undefined, { authorization: 'Bearer admin' });
  cases.push([await call('GET', `${a.link}/read`), 410]);
  for (const [res, status] of cases) {
    assert.equal(res.status, status, JSON.stringify(res.json));
    assert.match(res.json.error, /^[a-z]+(_[a-z]+)*$/);
    assert.deepEqual(Object.keys(res.json), THREE);
    assert.ok(res.json.message && res.json.instruction, res.json.error);
  }
});
