import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (skill) => fs.readFileSync(new URL(`../skills/${skill}/SKILL.md`, import.meta.url), 'utf8');

function roomRules(skill) {
  const match = read(skill).match(/<!-- room-rules:start[^>]*-->[\s\S]*?<!-- room-rules:end -->/);
  assert.ok(match, `${skill} has no room-rules block`);
  return match[0];
}

test('huddle-start and huddle-join carry the same room rules', () => {
  assert.equal(roomRules('huddle-start'), roomRules('huddle-join'));
});

test('the lead sets the room brief and every agent reads it from the join reply', () => {
  const leading = read('huddle-start').split('## Leading')[1];
  assert.match(leading, /\$LINK\/brief/);
  assert.match(leading, /"after"/);
  assert.match(roomRules('huddle-join'), /join reply carries the room `brief` and `folder`/);
});

test('the room rules tell agents to report their folder and heed the outside warning', () => {
  assert.match(roomRules('huddle-join'), /Report your current folder when you join/);
  assert.match(roomRules('huddle-join'), /outside the room folder/);
});

test('no skill points agents at a separate core skill', () => {
  for (const skill of ['huddle-start', 'huddle-join', 'huddle-rooms', 'huddle-end']) {
    assert.doesNotMatch(read(skill), /core skill|Reference protocol/, skill);
  }
});

test('the agent-huddle folder is a hidden engine skill', () => {
  const head = read('agent-huddle').split('---')[1];
  assert.match(head, /^user-invocable: false$/m);
  assert.match(head, /^disable-model-invocation: true$/m);
});

test('room rules explain Listening, Working and Asleep and when to declare working time', () => {
  for (const skill of ['huddle-start', 'huddle-join']) {
    const rules = roomRules(skill);
    assert.match(rules, /\*\*Working\*\* for 10 min after any room call other than `wait`/, skill);
    assert.match(rules, /\*\*Listening\*\* while you only wait/, skill);
    assert.match(rules, /\*\*Asleep\*\* after 10 min of silence/, skill);
    assert.match(rules, /"workingMinutes": N/, skill);
  }
});

test('room rules and protocols tell agents to follow the instruction on an error', async () => {
  for (const skill of ['huddle-start', 'huddle-join']) {
    const rules = roomRules(skill);
    assert.match(rules, /`\{"error":"<code>","message":"\.\.\.","instruction":"\.\.\."\}`: read the message, follow the instruction before retrying/, skill);
    assert.match(rules, /429 `round_cap`/, skill);
    assert.match(read(skill), /`\{"error":"room_ended","message":\.\.\.,"instruction":\.\.\.\}`/, skill);
  }
  const src = fs.readFileSync(new URL('../skills/agent-huddle/huddle.mjs', import.meta.url), 'utf8');
  assert.match(src, /Errors are JSON: error \(a code\), message \(what went wrong\) and instruction/);
  assert.match(src, /A refused call returns \{"error":"<code>","message":"\.\.\.","instruction":"\.\.\."\}: follow the instruction before retrying/);
});

test('AC-92: room rules tell agents to reopen a wrong task and to stop when sent off shift', () => {
  for (const skill of ['huddle-start', 'huddle-join']) {
    const rules = roomRules(skill);
    assert.match(rules, /reopen it with a reason \(`POST \$LINK\/tasks\/<n>\/reopen`/, skill);
    assert.match(rules, /Off shift \(`wait` exits 5, `"offShift":true`\): stop waiting and end your turn/, skill);
    assert.match(rules, /5 \(off shift; stop waiting\)/, skill);
  }
  const leading = read('huddle-start').split('## Leading')[1].split('<!-- room-rules:start')[0];
  assert.match(leading, /`system` sends @you a summary from the done notes/);
  assert.doesNotMatch(leading, /post one summary to @you/);
});

test('huddle-end asks before ending, then about the server only when no rooms remain', () => {
  const skill = read('huddle-end');
  const head = skill.split('---')[1];
  assert.doesNotMatch(head, /server stops with the last room/);
  assert.match(head, /Asks before ending/);
  const steps = skill.split('## Steps')[1];
  const ask = steps.indexOf('End "<room>" (<id8>, N agents)? It kicks every agent out and cannot be undone.');
  assert.ok(ask > -1);
  assert.ok(steps.indexOf('--yes') > ask);
  assert.match(steps, /On no, end nothing and ask nothing else/);
  assert.match(steps, /Only when the output says no rooms are left, ask "Stop the huddle server too\?"/);
  assert.match(steps, /Yes: `node \$HUDDLE down`/);
  assert.match(skill, /It is not the yes for `end`/);
});

test('AC-21.5: start and join offer page approvals for Claude Code and Codex, writing the hook only on request', () => {
  for (const skill of ['huddle-start', 'huddle-join']) {
    const steps = read(skill).split('## Steps')[1].split('<!-- room-rules:start')[0];
    assert.ok(steps.includes('node "$HUDDLE" approvals on "$LINK" --session "${CLAUDE_SESSION_ID}"'), skill);
    assert.match(steps, /add `--write` only when the user explicitly asks you to write it/, skill);
    assert.match(steps, /runs `\/hooks` once to trust it/, skill);
  }
});

test('AC-23.2: room rules tell agents to take a role they are given and how to change it', () => {
  for (const skill of ['huddle-start', 'huddle-join']) {
    const rules = roomRules(skill);
    assert.ok(rules.includes('node "$HUDDLE" role "$LINK" <role>'), skill);
    assert.match(rules, /`@lead` \(always the lead, whatever its role\)/, skill);
  }
});

test('AC-23.1: join takes the role from its line, start hands out lines with roles and joins the lead with one', () => {
  const join = read('huddle-join');
  assert.match(join.split('## Steps')[0], /optionally followed by `as <role>`/);
  assert.match(join, /Your role is the one after `as` in the line/);
  assert.doesNotMatch(join, /Take a role only if the user gave one/);
  const start = read('huddle-start');
  assert.match(start, /\$huddle-join <join URL> as builder/);
  assert.match(start, /--lead <lead> \[--role <role>\]/);
  assert.match(start.split('## Leading')[1], /Mention a role only when an agent holds it/);
});
