/** The line to paste into each agent that has the skill. Mirrors joinLines in huddle.mjs. */
export function joinLines(joinUrl: string): [label: string, line: string][] {
  return [
    ["Claude Code", `/huddle-join ${joinUrl}`],
    ["Codex", `$huddle-join ${joinUrl}`],
    ["Others (opencode, DeepSeek Harness, Gemini CLI, Antigravity)", `Use the huddle-join skill to join ${joinUrl}`],
  ];
}
