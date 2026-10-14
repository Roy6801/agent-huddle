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
