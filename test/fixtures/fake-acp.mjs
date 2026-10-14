import fs from 'node:fs';
import readline from 'node:readline';

// node --test also globs this file; only serve when a test opts in
if (!process.env.FAKE_ACP) process.exit(0);

const log = [];
let sessions = 0;
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const update = (sessionId, sessionUpdate, text) =>
  send({ method: 'session/update', params: { sessionId, update: { sessionUpdate, content: { type: 'text', text } } } });

const methods = {
  initialize: () => ({ protocolVersion: 1, agentCapabilities: {} }),
  'session/new': () => ({ sessionId: `fake-${++sessions}` }),
  'session/prompt': ({ sessionId, prompt }) => {
    const text = prompt.map((p) => p.text).join('');
    log.push({ sessionId, text });
    if (process.env.FAKE_ACP_LOG) fs.writeFileSync(process.env.FAKE_ACP_LOG, JSON.stringify(log));
    update(sessionId, 'agent_thought_chunk', 'thinking...');
    update(sessionId, 'agent_message_chunk', `echo(${sessionId}): `);
    update(sessionId, 'agent_message_chunk', text.split('\n').at(-1));
    return { stopReason: 'end_turn' };
  },
};

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.id === undefined) return;
  const fn = methods[msg.method];
  if (fn) send({ id: msg.id, result: fn(msg.params) });
  else send({ id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } });
});
