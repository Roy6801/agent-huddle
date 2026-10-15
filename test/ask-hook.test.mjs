import { test, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHuddle } from '../skills/agent-huddle/huddle.mjs';

const CLI = new URL('../skills/agent-huddle/huddle.mjs', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'huddle-ask-hook-'));
const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

let n = 0;
function sandbox() {
  const dir = path.join(tmp, String(++n));
  fs.mkdirSync(dir);
  const env = { ...process.env, AGENT_HUDDLE_HOME: path.join(dir, 'home'), CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), CODEX_HOME: path.join(dir, 'codex') };
  delete env.CODEX_THREAD_ID;
  return { dir, env };
}

function cli(env, args, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input ?? '');
  });
}

async function room(opts = {}) {
  const huddle = createHuddle({ adminToken: 'test-admin-token', ...opts });
  const port = await huddle.listen(0);
  running.push(huddle);
  const created = await (await fetch(`http://127.0.0.1:${port}/new`, { method: 'POST', body: '{"name":"approvals"}' })).json();
  const join = async (harness) => (await fetch(`${created.join}/join`, { method: 'POST', body: JSON.stringify({ harness }) })).json();
  const state = async () => (await fetch(`${created.page}/api/state`)).json();
  const openAsk = async () => {
    for (let i = 0; i < 100; i++) {
      const ask = (await state()).asks.find((a) => a.status === 'open');
      if (ask) return ask;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('no card appeared');
  };
  const answer = (id, optionId) => fetch(`${created.page}/api/asks/${id}`, { method: 'POST', body: JSON.stringify({ optionId }) });
  const end = () => fetch(`http://127.0.0.1:${port}/admin/rooms/${created.id}/end`, { method: 'POST', headers: { authorization: 'Bearer test-admin-token' } });
  return { port, join, state, openAsk, answer, end };
}

const SUGGESTIONS = [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'rm -rf node_modules' }], behavior: 'allow', destination: 'localSettings' }];
const claudeRequest = (session) => JSON.stringify({
  session_id: session,
  transcript_path: '/tmp/t.jsonl',
  cwd: '/work/app',
  permission_mode: 'default',
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf node_modules', description: 'Remove node_modules directory' },
  permission_suggestions: SUGGESTIONS,
});
const codexRequest = (session) => JSON.stringify({
  session_id: session,
  turn_id: 'turn-1',
  transcript_path: null,
  cwd: '/work/app',
  hook_event_name: 'PermissionRequest',
  model: 'gpt-5',
  permission_mode: 'on-request',
  tool_name: 'apply_patch',
  tool_input: { command: '*** Begin Patch\n*** Update File: src/a.js\n@@\n-a\n+b\n*** End Patch\n' },
});

const allow = '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}\n';
const deny = '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"Denied by the human on the agent-huddle room page."}}}\n';

test('AC-21.1: a bound Claude Code session asks on the page and prints the exact answer for each option', async () => {
  const { env } = sandbox();
  const r = await room();
  const agent = await r.join('claude');
  const bound = await cli(env, ['approvals', 'on', agent.link, '--session', 'claude-session']);
  assert.equal(bound.code, 0, bound.stderr);
  assert.match(bound.stdout, new RegExp(`as ${agent.handle}`));
  const always = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedPermissions: [{ ...SUGGESTIONS[0], destination: 'session' }] } } }) + '\n';
  for (const [optionId, expected] of [['allow', allow], ['always', always], ['deny', deny]]) {
    const hook = cli(env, ['ask-hook', 'claude'], claudeRequest('claude-session'));
    const ask = await r.openAsk();
    assert.equal(ask.by, agent.handle);
    assert.equal(ask.title, 'Bash: rm -rf node_modules');
    assert.equal(ask.detail, 'why: Remove node_modules directory\ncommand: rm -rf node_modules\nfolder: /work/app');
    assert.deepEqual(ask.options.map((o) => [o.optionId, o.kind, o.name]), [
      ['allow', 'allow_once', 'Allow once'], ['always', 'allow_always', 'Always'], ['deny', 'reject_once', 'Deny'],
    ]);
    assert.equal((await r.answer(ask.id, optionId)).status, 200);
    const out = await hook;
    assert.equal(out.code, 0);
    assert.equal(out.stdout, expected, optionId);
  }
  assert.ok((await r.state()).messages.some((m) => m.toYou && m.text === `${agent.handle} asks: Bash: rm -rf node_modules`));
});

test('AC-21.2: a Codex session bound through CODEX_THREAD_ID gets Allow once / Deny and the exact output', async () => {
  const { env } = sandbox();
  const r = await room();
  const agent = await r.join('codex');
  const bound = await cli({ ...env, CODEX_THREAD_ID: 'thread-1' }, ['approvals', 'on', agent.link]);
  assert.equal(bound.code, 0, bound.stderr);
  for (const [optionId, expected] of [['allow', allow], ['deny', deny]]) {
    const hook = cli(env, ['ask-hook', 'codex'], codexRequest('thread-1'));
    const ask = await r.openAsk();
    assert.equal(ask.title, 'apply_patch: src/a.js');
    assert.equal(ask.detail, 'command: *** Begin Patch\n*** Update File: src/a.js\n@@\n-a\n+b\n*** End Patch\nfolder: /work/app');
    assert.deepEqual(ask.options.map((o) => o.optionId), ['allow', 'deny']);
    await r.answer(ask.id, optionId);
    assert.equal((await hook).stdout, expected);
  }
});

test('AC-21.2: Claude Code without permission suggestions gets no Always option', async () => {
  const { env } = sandbox();
  const r = await room();
  const agent = await r.join('claude');
  await cli(env, ['approvals', 'on', agent.link, '--session', 's1']);
  const request = JSON.parse(claudeRequest('s1'));
  delete request.permission_suggestions;
  const hook = cli(env, ['ask-hook', 'claude'], JSON.stringify(request));
  const ask = await r.openAsk();
  assert.deepEqual(ask.options.map((o) => o.optionId), ['allow', 'deny']);
  await r.answer(ask.id, 'allow');
  assert.equal((await hook).stdout, allow);
});

test('AC-21.3: the hook prints nothing and exits 0 on every failure', async () => {
  const { env } = sandbox();
  const r = await room();
  const agent = await r.join('claude');
  await cli(env, ['approvals', 'on', agent.link, '--session', 'bound']);
  const quiet = async (args, input, extra = {}) => {
    const out = await cli({ ...env, ...extra }, args, input);
    assert.deepEqual([out.code, out.stdout, out.stderr], [0, '', ''], `${args.join(' ')} ${String(input).slice(0, 40)}`);
  };
  await quiet(['ask-hook', 'claude'], claudeRequest('not-bound'));
  await quiet(['ask-hook', 'claude'], 'not json');
  await quiet(['ask-hook', 'claude'], '');
  await quiet(['ask-hook', 'gemini'], claudeRequest('bound'));
  await quiet(['ask-hook'], claudeRequest('bound'));

  const timedOut = quiet(['ask-hook', 'claude'], claudeRequest('bound'), { AGENT_HUDDLE_ASK_HOOK_MS: '1500' });
  const ask = await r.openAsk();
  await timedOut;
  assert.equal((await r.state()).asks.find((a) => a.id === ask.id).status, 'cancelled');

  const left = quiet(['ask-hook', 'claude'], claudeRequest('bound'));
  await r.openAsk();
  await fetch(`${agent.link}/leave`, { method: 'POST', body: '{}' });
  await left;
});

test('AC-21.3: an ended room or a stopped server falls back to the terminal', async () => {
  const { env } = sandbox();
  const r = await room();
  const agent = await r.join('codex');
  await cli({ ...env, CODEX_THREAD_ID: 't' }, ['approvals', 'on', agent.link]);
  const ending = cli(env, ['ask-hook', 'codex'], codexRequest('t'));
  await r.openAsk();
  await r.end();
  assert.deepEqual(await ending, { code: 0, stdout: '', stderr: '' });
  assert.deepEqual(await cli(env, ['ask-hook', 'codex'], codexRequest('t')), { code: 0, stdout: '', stderr: '' });
  await running.pop().close();
  assert.deepEqual(await cli(env, ['ask-hook', 'codex'], codexRequest('t')), { code: 0, stdout: '', stderr: '' });
});

test('AC-21.4: approvals on refuses bad input, off removes the binding', async () => {
  const { env } = sandbox();
  const r = await room();
  const agent = await r.join('claude');
  const page = (await r.state()).room.join;
  let out = await cli(env, ['approvals', 'on', page, '--session', 's']);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /agent link/);
  out = await cli(env, ['approvals', 'on', agent.link]);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /--session/);
  out = await cli(env, ['approvals', 'on', `${agent.link}x`, '--session', 's']);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /not a live agent/);
  out = await cli(env, ['approvals', 'on', agent.link, '--session=s']);
  assert.equal(out.code, 0, out.stderr);
  const file = path.join(env.AGENT_HUDDLE_HOME, 'approvals.json');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).s.link, agent.link);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  out = await cli(env, ['approvals', 'off', '--session', 's']);
  assert.match(out.stdout, /in the terminal again/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {});
});

test('approvals on and the hook never send prompts to a link off this machine', async () => {
  const { env } = sandbox();
  // A stand-in for a remote room that would answer every prompt with allow. The IPv4-mapped address reaches it
  // from here, but its host name is not one of the loopback names.
  const seen = [];
  const remote = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.setHeader('content-type', 'application/json');
    res.end(req.url.endsWith('/me') ? '{"handle":"remote-1"}' : '{"id":1,"status":"answered","answer":{"optionId":"allow"}}');
  });
  await new Promise((resolve) => remote.listen(0, '127.0.0.1', resolve));
  running.push({ close: () => new Promise((resolve) => remote.close(resolve)) });
  const link = `http://[::ffff:127.0.0.1]:${remote.address().port}/s/room/as/token`;

  const out = await cli(env, ['approvals', 'on', link, '--session', 's']);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /only talks to this machine/);

  fs.mkdirSync(env.AGENT_HUDDLE_HOME, { recursive: true });
  fs.writeFileSync(path.join(env.AGENT_HUDDLE_HOME, 'approvals.json'), JSON.stringify({ s: { link, handle: 'remote-1', at: new Date().toISOString() } }), { mode: 0o600 });
  assert.deepEqual(await cli(env, ['ask-hook', 'claude'], claudeRequest('s')), { code: 0, stdout: '', stderr: '' });
  assert.deepEqual(seen, []);
});

test('AC-21.4: approvals claude|codex prints the hook; --write merges it once and keeps other settings', async () => {
  const { env } = sandbox();
  const printed = await cli(env, ['approvals', 'claude']);
  assert.equal(printed.code, 0, printed.stderr);
  const settings = path.join(env.CLAUDE_CONFIG_DIR, 'settings.json');
  assert.ok(printed.stdout.startsWith(`Add this to ${settings}`));
  assert.ok(printed.stdout.includes(`"command": "node ${JSON.stringify(CLI).replace(/"/g, '\\"')} ask-hook claude"`));
  assert.ok(!fs.existsSync(settings));

  fs.mkdirSync(env.CLAUDE_CONFIG_DIR);
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'audit.sh' }] };
  fs.writeFileSync(settings, JSON.stringify({ model: 'opus', hooks: { PermissionRequest: [other], Stop: [] } }));
  for (let i = 0; i < 2; i++) assert.equal((await cli(env, ['approvals', 'claude', '--write'])).code, 0);
  const written = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(written.model, 'opus');
  assert.deepEqual(written.hooks.Stop, []);
  assert.deepEqual(written.hooks.PermissionRequest, [other, {
    matcher: '.*',
    hooks: [{ type: 'command', command: `node ${JSON.stringify(CLI)} ask-hook claude`, timeout: 200, statusMessage: 'Asking on the agent-huddle room page' }],
  }]);

  assert.match((await cli(env, ['approvals', 'codex'])).stdout, /run \/hooks once to trust it/);
  const codex = await cli(env, ['approvals', 'codex', '--write']);
  assert.match(codex.stdout, /hook not trusted yet: run \/hooks in Codex once/);
  const hooks = JSON.parse(fs.readFileSync(path.join(env.CODEX_HOME, 'hooks.json'), 'utf8'));
  assert.equal(hooks.hooks.PermissionRequest[0].hooks[0].command, `node ${JSON.stringify(CLI)} ask-hook codex`);

  fs.writeFileSync(settings, '{oops');
  const broken = await cli(env, ['approvals', 'claude', '--write']);
  assert.equal(broken.code, 1);
  assert.match(broken.stderr, /not valid JSON/);
  assert.equal(fs.readFileSync(settings, 'utf8'), '{oops');
});

test('AC-40.8: approvals codex tells whether Codex trusts the hook, from its config.toml', async () => {
  const { env } = sandbox();
  fs.mkdirSync(env.CODEX_HOME);
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'audit.sh' }] };
  fs.writeFileSync(path.join(env.CODEX_HOME, 'hooks.json'), JSON.stringify({ hooks: { PermissionRequest: [other] } }));
  await cli(env, ['approvals', 'codex', '--write']);
  const config = path.join(env.CODEX_HOME, 'config.toml');
  const key = JSON.stringify(`${path.join(env.CODEX_HOME, 'hooks.json')}:permission_request:1:0`);
  const status = async () => (await cli(env, ['approvals', 'codex'])).stdout;

  fs.writeFileSync(config, `model = "gpt-5"\n\n[hooks.state.${JSON.stringify(`${path.join(env.CODEX_HOME, 'hooks.json')}:permission_request:0:0`)}]\ntrusted_hash = "sha256:aa"\n`);
  assert.match(await status(), /Codex: hook not trusted yet: run \/hooks in Codex once/, 'trust of another hook does not count');
  fs.writeFileSync(config, `[hooks.state.${key}]\nenabled = true\n`);
  assert.match(await status(), /hook not trusted yet/, 'a state entry without a hash is not trust');
  fs.writeFileSync(config, `model = "gpt-5"\n\n[hooks.state.${key}]\ntrusted_hash = "sha256:0123abcd"\n\n[tui]\nnotifications = true\n`);
  assert.match(await status(), /Codex: hook trusted\./);
  fs.writeFileSync(config, `[hooks.state]\n${key} = { trusted_hash = "sha256:0123abcd" }\n`);
  assert.match(await status(), /Codex: hook trusted\./, 'an inline table counts too');
});

test('AC-21.5: terminal Claude Code and Codex agents are told about page approvals; others are not', async () => {
  const r = await room();
  const reference = async (harness) => (await fetch((await r.join(harness)).link)).text();
  assert.match(await reference('claude'), /Page approvals: node .*huddle\.mjs approvals on '[^']+' --session <your session id>/);
  assert.match(await reference('codex'), /Page approvals: node .*huddle\.mjs approvals on '[^']+'   \(optional/);
  assert.doesNotMatch(await reference('gemini'), /Page approvals/);
});
