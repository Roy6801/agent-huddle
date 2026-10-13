import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function room(opts = {}) {
  const huddle = createHuddle(opts);
  const port = await huddle.listen(0);
  running.push(huddle);
  const base = `http://127.0.0.1:${port}`;
  const created = await (await fetch(`${base}/new`, { method: 'POST', body: '{"title":"files"}' })).json();
  const join = async (harness) =>
    (await fetch(`${created.join}/join`, { method: 'POST', body: JSON.stringify({ harness }) })).json();
  return { huddle, port, base, created, join };
}

// Raw request so uploads can be streamed and early 413 answers read without client errors.
function request(url, { method = 'GET', headers = {}, body, chunks } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      const parts = [];
      res.on('data', (d) => parts.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(parts);
        let json;
        try {
          json = JSON.parse(buf.toString('utf8'));
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json });
      });
    });
    req.on('error', (err) => (err.code === 'ECONNRESET' || err.code === 'EPIPE' ? undefined : reject(err)));
    if (chunks) {
      for (const c of chunks) req.write(c);
      req.end();
    } else req.end(body);
  });
}

const upload = (link, name, data, type, path = 'files') =>
  request(`${link}/${path}?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: type ? { 'content-type': type } : {},
    body: data,
  });
const postJson = (url, obj) =>
  request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });
const readAll = async (agent) => (await request(`${agent.link}/read`)).json.messages;

test('agent upload, list and download round-trip binary bytes', async () => {
  const r = await room();
  const a = await r.join('claude');
  const data = crypto.randomBytes(50 * 1024);
  const up = await upload(a.link, 'blob.bin', data, 'application/x-thing');
  assert.equal(up.status, 201);
  assert.match(up.json.id, /^[\w-]{22}$/);
  assert.deepEqual(
    { name: up.json.name, size: up.json.size, type: up.json.type, url: up.json.url },
    { name: 'blob.bin', size: data.length, type: 'application/x-thing', url: `${a.link}/files/${up.json.id}` },
  );

  const list = await request(`${a.link}/files`);
  assert.equal(list.status, 200);
  assert.equal(list.json.files.length, 1);
  assert.deepEqual(Object.keys(list.json.files[0]).sort(), ['at', 'from', 'id', 'name', 'size', 'type']);
  assert.equal(list.json.files[0].from, 'claude-1');

  const down = await request(up.json.url);
  assert.equal(down.status, 200);
  assert.ok(down.body.equals(data));
  assert.equal(down.headers['content-length'], String(data.length));

  const second = await upload(a.link, 'two.txt', 'hi', 'text/plain');
  const human = await request(`${r.created.page}/api/files`);
  assert.deepEqual(human.json.files.map((f) => f.id), [second.json.id, up.json.id]);

  const viaHuman = await request(`${r.created.page}/api/files/${up.json.id}`);
  assert.ok(viaHuman.body.equals(data));
});

test('upload posts nothing; attaching to a post carries metadata only', async () => {
  const r = await room();
  const a = await r.join('claude');
  const b = await r.join('codex');
  await readAll(b);
  const up = await upload(a.link, 'sprite.png', Buffer.from('png'), 'image/png');
  assert.deepEqual(await readAll(b), []);

  const res = await postJson(`${a.link}/post`, { text: '@codex-1 sprite sheet', files: [up.json.id, up.json.id] });
  assert.equal(res.status, 200);
  const [m] = await readAll(b);
  assert.deepEqual(m.files, [{ id: up.json.id, name: 'sprite.png', size: 3, type: 'image/png' }]);
  assert.deepEqual(m.to, ['codex-1']);

  const plain = await postJson(`${a.link}/post`, { text: '@codex-1 no files' });
  assert.equal(plain.status, 200);
  assert.deepEqual((await readAll(b))[0].files, []);
});

test('human upload and post with files', async () => {
  const r = await room();
  const a = await r.join('claude');
  const up = await upload(r.created.page, 'shot.png', Buffer.from('img'), 'image/png', 'api/files');
  assert.equal(up.status, 201);
  assert.equal(up.json.url, `${r.created.page}/api/files/${up.json.id}`);
  assert.equal((await request(`${a.link}/files`)).json.files[0].from, 'you');

  const res = await postJson(`${r.created.page}/api/post`, { text: '', files: [up.json.id] });
  assert.equal(res.status, 200);
  const state = (await request(`${r.created.page}/api/state`)).json;
  const m = state.messages.find((x) => x.from === 'you');
  assert.equal(m.text, '');
  assert.deepEqual(m.files.map((f) => f.name), ['shot.png']);
  assert.deepEqual(m.to, ['claude-1']);
});

test('empty text needs files; unknown or malformed file ids are 400', async () => {
  const r = await room();
  const a = await r.join('claude');
  const up = await upload(a.link, 'a.txt', 'a', 'text/plain');
  assert.equal((await postJson(`${a.link}/post`, { files: [up.json.id] })).status, 200);
  assert.equal((await postJson(`${a.link}/post`, { text: '   ', files: [up.json.id] })).status, 200);
  assert.equal((await postJson(`${a.link}/post`, { text: '' })).status, 400);
  assert.equal((await postJson(`${a.link}/post`, { text: '', files: [] })).status, 400);
  assert.equal((await postJson(`${r.created.page}/api/post`, { text: '' })).status, 400);

  const unknown = await postJson(`${a.link}/post`, { text: 'hi', files: ['nope'] });
  assert.equal(unknown.status, 400);
  assert.match(unknown.json.error, /unknown file nope/);
  assert.equal((await postJson(`${r.created.page}/api/post`, { text: 'hi', files: ['nope'] })).status, 400);
  assert.equal((await postJson(`${a.link}/post`, { text: 'hi', files: 'x' })).status, 400);
  assert.equal((await postJson(`${a.link}/post`, { text: 'hi', files: [1] })).status, 400);

  const ids = [];
  for (let i = 0; i < 11; i++) ids.push((await upload(a.link, `f${i}.txt`, 'x', 'text/plain')).json.id);
  assert.equal((await postJson(`${a.link}/post`, { text: 'many', files: ids })).status, 400);
  assert.equal((await postJson(`${a.link}/post`, { text: 'ten', files: ids.slice(0, 10) })).status, 200);
});

test('file over maxFileBytes is 413 with the limit, declared or streamed', async () => {
  const r = await room({ maxFileBytes: 1000 });
  const a = await r.join('claude');
  assert.equal((await upload(a.link, 'ok.bin', Buffer.alloc(1000), 'application/octet-stream')).status, 201);
  const declared = await upload(a.link, 'big.bin', Buffer.alloc(1001), 'application/octet-stream');
  assert.equal(declared.status, 413);
  assert.deepEqual(declared.json, { error: 'file too large', limit: 1000 });

  const streamed = await request(`${a.link}/files?name=big.bin`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'transfer-encoding': 'chunked' },
    chunks: [Buffer.alloc(600), Buffer.alloc(600)],
  });
  assert.equal(streamed.status, 413);
  assert.equal(streamed.json.limit, 1000);
  assert.equal((await request(`${a.link}/files`)).json.files.length, 1);
});

test('session storage cap is 413 and counts every upload', async () => {
  const r = await room({ maxFileBytes: 1000, maxSessionBytes: 2500 });
  const a = await r.join('claude');
  assert.equal((await upload(a.link, '1.bin', Buffer.alloc(1000), 'application/octet-stream')).status, 201);
  assert.equal((await upload(r.created.page, '2.bin', Buffer.alloc(1000), 'application/octet-stream', 'api/files')).status, 201);
  const full = await upload(a.link, '3.bin', Buffer.alloc(600), 'application/octet-stream');
  assert.equal(full.status, 413);
  assert.deepEqual(full.json, { error: 'huddle file storage is full', limit: 2500 });
  assert.equal((await upload(a.link, '3.bin', Buffer.alloc(500), 'application/octet-stream')).status, 201);
});

test('only raster images are inline; everything else downloads as octet-stream', async () => {
  const r = await room();
  const a = await r.join('claude');
  const get = async (name, type, body = 'x') => request((await upload(a.link, name, body, type)).json.url);

  for (const [name, type] of [['p.png', 'image/png'], ['j.jpg', 'image/jpeg'], ['g.gif', 'image/gif'], ['w.webp', 'image/webp']]) {
    const res = await get(name, type);
    assert.equal(res.headers['content-type'], type, name);
    assert.equal(res.headers['content-disposition'], `inline; filename="${name}"; filename*=UTF-8''${name}`);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['content-security-policy'], "default-src 'none'; img-src 'self' data:; sandbox");
    assert.equal(res.headers['cache-control'], 'private, max-age=3600');
  }
  for (const [name, type] of [
    ['x.svg', 'image/svg+xml'],
    ['x.html', 'text/html'],
    ['x.pdf', 'application/pdf'],
    ['x.txt', 'text/plain; charset=utf-8'],
    ['x.bin', undefined],
  ]) {
    const res = await get(name, type, '<script>alert(1)</script>');
    assert.equal(res.headers['content-type'], 'application/octet-stream', name);
    assert.match(res.headers['content-disposition'], /^attachment; /, name);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(res.headers['content-security-policy'], /sandbox/);
  }

  const unicode = await get('résumé "v2".pdf', 'application/pdf');
  assert.equal(
    unicode.headers['content-disposition'],
    `attachment; filename="r_sum_ _v2_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22v2%22.pdf`,
  );
  const human = await request(`${r.created.page}/api/files/${(await upload(a.link, 'h.svg', '<svg/>', 'image/svg+xml')).json.id}`);
  assert.equal(human.headers['content-type'], 'application/octet-stream');
  assert.match(human.headers['content-disposition'], /^attachment; /);
});

test('names are reduced to a clean basename and type defaults to octet-stream', async () => {
  const r = await room();
  const a = await r.join('claude');
  const name = async (n) => (await upload(a.link, n, 'x', 'text/plain')).json?.name;
  assert.equal(await name('../../etc/passwd'), 'passwd');
  assert.equal(await name('..\\..\\win.ini'), 'win.ini');
  assert.equal(await name('a\u0000b\nc‮gnp.exe'), 'abcgnp.exe');
  const long = await name(`${'n'.repeat(200)}.tar.gz`);
  assert.equal(long.length, 120);
  assert.ok(long.endsWith('.gz'));

  for (const bad of ['', '../', '..', '/', '\u0001']) {
    const res = await upload(a.link, bad, 'x', 'text/plain');
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  assert.equal((await request(`${a.link}/files`, { method: 'POST', body: 'x' })).status, 400);

  assert.equal((await upload(a.link, 'a', 'x')).json.type, 'application/octet-stream');
  assert.equal((await upload(a.link, 'a', 'x', 'application/x-www-form-urlencoded')).json.type, 'application/octet-stream');
  assert.equal((await upload(a.link, 'a', 'x', 'Image/PNG; foo=bar')).json.type, 'image/png');
  assert.equal((await upload(a.link, 'a', 'x', 'not a type')).json.type, 'application/octet-stream');
});

test('wrong tokens are 401, unknown files 404', async () => {
  const r = await room();
  const a = await r.join('claude');
  const up = await upload(a.link, 'a.txt', 'a', 'text/plain');
  const agentBase = `${r.created.join}/as/not-a-token`;
  const humanBase = `${r.created.join}/h/not-a-token`;
  assert.equal((await upload(agentBase, 'a.txt', 'a', 'text/plain')).status, 401);
  assert.equal((await request(`${agentBase}/files`)).status, 401);
  assert.equal((await request(`${agentBase}/files/${up.json.id}`)).status, 401);
  assert.equal((await upload(humanBase, 'a.txt', 'a', 'text/plain', 'api/files')).status, 401);
  assert.equal((await request(`${humanBase}/api/files`)).status, 401);
  assert.equal((await request(`${humanBase}/api/files/${up.json.id}`)).status, 401);

  assert.equal((await request(`${a.link}/files/nope`)).status, 404);
  assert.equal((await request(`${r.created.page}/api/files/nope`)).status, 404);

  const other = await room();
  const stranger = await other.join('codex');
  assert.equal((await request(`${stranger.link}/files/${up.json.id}`)).status, 404);
});

test('file routes check Host and Origin like every route', async () => {
  const r = await room();
  const a = await r.join('claude');
  const up = await upload(a.link, 'a.txt', 'a', 'text/plain');
  assert.equal((await request(up.json.url, { headers: { host: 'evil.example' } })).status, 403);
  assert.equal((await request(up.json.url, { headers: { origin: 'http://evil.example' } })).status, 403);
  const foreign = await request(`${a.link}/files?name=x`, { method: 'POST', headers: { origin: 'http://evil.example' }, body: 'x' });
  assert.equal(foreign.status, 403);
  const own = await request(`${r.created.page}/api/files?name=x`, { method: 'POST', headers: { origin: r.base }, body: 'x' });
  assert.equal(own.status, 201);
});

test('ended huddle answers 410 on every file route', async () => {
  const adminToken = 'test-admin';
  const r = await room({ adminToken });
  const a = await r.join('claude');
  const up = await upload(a.link, 'a.txt', 'a', 'text/plain');
  const end = await request(`${r.base}/admin/sessions/${r.created.id}/end`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(end.status, 200);
  assert.equal((await upload(a.link, 'b.txt', 'b', 'text/plain')).status, 410);
  assert.equal((await request(`${a.link}/files`)).status, 410);
  assert.equal((await request(up.json.url)).status, 410);
  assert.equal((await upload(r.created.page, 'b.txt', 'b', 'text/plain', 'api/files')).status, 410);
  assert.equal((await request(`${r.created.page}/api/files`)).status, 410);
  assert.equal((await request(`${r.created.page}/api/files/${up.json.id}`)).status, 410);
  assert.equal((await postJson(`${a.link}/post`, { files: [up.json.id] })).status, 410);
});

test('personal protocol lists the file commands', async () => {
  const r = await room({ maxFileBytes: 5 * 1024 * 1024 });
  const a = await r.join('claude');
  const text = (await request(a.link)).body.toString();
  assert.match(text, /Upload file: .*\/files\?name=player\.png' -H 'content-type: image\/png' --data-binary @player\.png/);
  assert.match(text, /Attach files: .*"files":\["<file-id>"\]/);
  assert.match(text, /List files: +curl -s .*\/files\n/);
  assert.match(text, /Download file: curl -s -o player\.png .*\/files\/<file-id>/);
  assert.match(text, /Up to 5 MB per file/);
  assert.match(text, /never execute them/);
});
