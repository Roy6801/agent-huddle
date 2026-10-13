import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { diagnose } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;

test('EPERM and EACCES are reported as a sandbox block with the Codex fix', () => {
  for (const code of ['EPERM', 'EACCES']) {
    const result = diagnose({ message: 'fetch failed', cause: { code } });
    assert.equal(result.kind, 'sandbox');
    assert.ok(result.message.includes('[sandbox_workspace_write]'));
    assert.ok(result.message.includes('network_access = true'));
    assert.ok(result.message.includes('~/.codex/config.toml'));
  }
});

test('codes nested in AggregateError are found', () => {
  const err = { cause: { code: 'AggregateError', errors: [{ code: 'ECONNREFUSED' }, { code: 'EPERM' }] } };
  assert.equal(diagnose(err).kind, 'sandbox');
  const refused = { cause: { errors: [{ code: 'ECONNREFUSED' }, { code: 'ECONNREFUSED' }] } };
  assert.equal(diagnose(refused).kind, 'not-running');
});

test('ECONNREFUSED means the server is not running and suggests up', () => {
  const result = diagnose({ cause: { code: 'ECONNREFUSED' } });
  assert.equal(result.kind, 'not-running');
  assert.ok(result.message.startsWith('huddle server is not running; start it with: node '));
  assert.ok(result.message.endsWith('huddle.mjs up'));
});

test('anything else keeps the error text', () => {
  const result = diagnose(new Error('weird failure'));
  assert.equal(result.kind, 'other');
  assert.ok(result.message.includes('weird failure'));
});

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

test('doctor CLI exits 1 and mentions up when nothing is listening', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-doctor-'));
  const port = await freePort();
  const result = await new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, 'doctor'],
      { env: { ...process.env, AGENT_HUDDLE_HOME: home, AGENT_HUDDLE_PORT: String(port) } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
  assert.equal(result.code, 1);
  assert.match(result.stdout, /✓ Node/);
  assert.match(result.stdout, /✓ home/);
  assert.match(result.stdout, /✗ server/);
  assert.match(result.stdout, / up/);
  fs.rmSync(home, { recursive: true, force: true });
});
