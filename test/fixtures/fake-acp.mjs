import fs from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

// node --test also globs this file; only serve when a test opts in
if (!process.env.FAKE_ACP) process.exit(0);

const { FAKE_ACP_LOG, FAKE_ACP_PID, FAKE_ACP_DELAY_MS, FAKE_ACP_STOP, FAKE_ACP_NEW_FAIL, FAKE_ACP_HANG, FAKE_ACP_GRANDCHILD, FAKE_ACP_REPLY, FAKE_ACP_PERMISSION, FAKE_ACP_MODES, FAKE_ACP_SPLIT } = process.env;
if (FAKE_ACP_PID) fs.writeFileSync(FAKE_ACP_PID, String(process.pid));
if (FAKE_ACP_GRANDCHILD) {
  const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  fs.writeFileSync(FAKE_ACP_GRANDCHILD, String(grandchild.pid));
}

const log = [];
const cancels = [];
const outcomes = [];
const modes = [];
const pendingReplies = new Map();
let nextReq = 1;
let sessions = 0;
let inflight = 0;
let maxConcurrency = 0;
let active = null;
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const update = (sessionId, sessionUpdate, text, messageId) =>
  send({ method: 'session/update', params: { sessionId, update: { sessionUpdate, content: { type: 'text', text }, ...(messageId && { messageId }) } } });
// Two messages with a tool call between, the second streamed as two deltas; 'ids' tags them like codex-acp does.
const split = (sessionId, ids) => {
  update(sessionId, 'agent_message_chunk', 'I will look at it.', ids && 'm1');
  send({ method: 'session/update', params: { sessionId, update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'ls', kind: 'execute', status: 'completed' } } });
  update(sessionId, 'agent_message_chunk', '@you it', ids && 'm2');
  update(sessionId, 'agent_message_chunk', ' is done.', ids && 'm2');
};
const save = () => {
  if (!FAKE_ACP_LOG) return;
  fs.writeFileSync(`${FAKE_ACP_LOG}.tmp`, JSON.stringify({ prompts: log, cancels, outcomes, modes, maxConcurrency }));
  fs.renameSync(`${FAKE_ACP_LOG}.tmp`, FAKE_ACP_LOG);
};

const methods = {
  initialize: () => ({ protocolVersion: 1, agentCapabilities: {} }),
  'session/new': () => {
    if (FAKE_ACP_NEW_FAIL) throw Object.assign(new Error('auth required'), { code: -32000 });
    const availableModes = FAKE_ACP_MODES?.split(',').map((id) => ({ id, name: id }));
    return { sessionId: `fake-${++sessions}`, ...(availableModes && { modes: { currentModeId: 'default', availableModes } }) };
  },
  'session/set_mode': ({ sessionId, modeId }) => {
    modes.push({ sessionId, modeId });
    save();
    return {};
  },
  'session/prompt': async ({ sessionId, prompt }) => {
    const text = prompt.map((p) => p.text).join('');
    log.push({ sessionId, text });
    maxConcurrency = Math.max(maxConcurrency, ++inflight);
    save();
    let chosen = '';
    if (FAKE_ACP_PERMISSION) {
      const id = `req-${nextReq++}`;
      const answer = new Promise((resolve) => pendingReplies.set(id, resolve));
      send({
        id,
        method: 'session/request_permission',
        params: {
          sessionId,
          toolCall: { toolCallId: 't1', title: 'Write ../outside.txt', kind: 'edit', locations: [{ path: '/tmp/outside.txt' }] },
          options: [
            { optionId: 'allow_once', kind: 'allow_once', name: 'Allow' },
            { optionId: 'allow_for_session', kind: 'allow_always', name: 'Always' },
            { optionId: 'decline', kind: 'reject_once', name: 'Decline' },
            { optionId: 'cancel', kind: 'reject_once', name: 'Cancel' },
          ],
        },
      });
      const outcome = (await answer).outcome;
      outcomes.push(outcome);
      save();
      chosen = outcome.optionId ?? outcome.outcome;
    }
    return new Promise((resolve) => {
      const done = (result) => {
        inflight--;
        active = null;
        resolve(result);
      };
      const timer = setTimeout(() => {
        update(sessionId, 'agent_thought_chunk', 'thinking...');
        if (FAKE_ACP_SPLIT) {
          split(sessionId, FAKE_ACP_SPLIT === 'ids');
          return done({ stopReason: 'end_turn' });
        }
        update(sessionId, 'agent_message_chunk', `echo(${sessionId}): `);
        update(sessionId, 'agent_message_chunk', `${FAKE_ACP_REPLY ?? text.split('\n').at(-1)}${chosen && ` [${chosen}]`}`);
        if (FAKE_ACP_STOP === 'refusal') done({ stopReason: 'refusal' });
        else if (FAKE_ACP_STOP === 'meta-fail') done({ stopReason: 'end_turn', _meta: { jetbrains: { air: { sessionFailure: { title: 'boom', severity: 'error' } } } } });
        else done({ stopReason: 'end_turn' });
      }, Number(FAKE_ACP_DELAY_MS) || 0);
      active = () => {
        clearTimeout(timer);
        done({ stopReason: 'cancelled' });
      };
    });
  },
};

readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  const msg = JSON.parse(line);
  if (pendingReplies.has(msg.id)) {
    pendingReplies.get(msg.id)(msg.result ?? { outcome: { outcome: 'cancelled' } });
    pendingReplies.delete(msg.id);
    return;
  }
  if (msg.id === undefined) {
    if (msg.method === 'session/cancel') {
      cancels.push(msg.params.sessionId);
      save();
      if (!FAKE_ACP_HANG) active?.();
    }
    return;
  }
  const fn = methods[msg.method];
  if (!fn) return send({ id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } });
  try {
    send({ id: msg.id, result: await fn(msg.params) });
  } catch (err) {
    send({ id: msg.id, error: { code: err.code ?? -32603, message: err.message } });
  }
});
