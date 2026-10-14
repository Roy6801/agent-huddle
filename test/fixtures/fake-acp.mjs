import fs from 'node:fs';
import readline from 'node:readline';

// node --test also globs this file; only serve when a test opts in
if (!process.env.FAKE_ACP) process.exit(0);

const { FAKE_ACP_LOG, FAKE_ACP_PID, FAKE_ACP_DELAY_MS, FAKE_ACP_STOP, FAKE_ACP_NEW_FAIL, FAKE_ACP_HANG } = process.env;
if (FAKE_ACP_PID) fs.writeFileSync(FAKE_ACP_PID, String(process.pid));

const log = [];
let sessions = 0;
let inflight = 0;
let maxConcurrency = 0;
let active = null;
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const update = (sessionId, sessionUpdate, text) =>
  send({ method: 'session/update', params: { sessionId, update: { sessionUpdate, content: { type: 'text', text } } } });
const save = () => FAKE_ACP_LOG && fs.writeFileSync(FAKE_ACP_LOG, JSON.stringify({ prompts: log, maxConcurrency }));

const methods = {
  initialize: () => ({ protocolVersion: 1, agentCapabilities: {} }),
  'session/new': () => {
    if (FAKE_ACP_NEW_FAIL) throw Object.assign(new Error('auth required'), { code: -32000 });
    return { sessionId: `fake-${++sessions}` };
  },
  'session/prompt': ({ sessionId, prompt }) => {
    const text = prompt.map((p) => p.text).join('');
    log.push({ sessionId, text });
    maxConcurrency = Math.max(maxConcurrency, ++inflight);
    save();
    return new Promise((resolve) => {
      const done = (result) => {
        inflight--;
        active = null;
        resolve(result);
      };
      const timer = setTimeout(() => {
        update(sessionId, 'agent_thought_chunk', 'thinking...');
        update(sessionId, 'agent_message_chunk', `echo(${sessionId}): `);
        update(sessionId, 'agent_message_chunk', text.split('\n').at(-1));
        if (FAKE_ACP_STOP === 'refusal') done({ stopReason: 'refusal' });
        else if (FAKE_ACP_STOP === 'meta-fail') done({ stopReason: 'end_turn', _meta: { error: 'boom' } });
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
  if (msg.id === undefined) {
    if (msg.method === 'session/cancel' && !FAKE_ACP_HANG) active?.();
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
