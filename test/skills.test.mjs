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
