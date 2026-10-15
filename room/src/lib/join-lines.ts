/** The line to paste into each agent that has the skill; a role adds ` as <role>`. Mirrors joinLines in huddle.mjs. */
export function joinLines(joinUrl: string, role: string | null = null): [label: string, line: string][] {
  const as = role ? ` as ${role}` : "";
  return [
    ["Claude Code", `/huddle-join ${joinUrl}${as}`],
    ["Codex", `$huddle-join ${joinUrl}${as}`],
    ["Others (opencode, DeepSeek Harness, Gemini CLI, Antigravity)", `Use the huddle-join skill to join ${joinUrl}${as}`],
  ];
}

const RESERVED_ROLES = new Set(["all", "you", "system", "headless"]);

/** A role the server takes: 1-20 lowercase letters, digits or dashes, not a reserved word. */
export const validRole = (role: string) => /^[a-z0-9-]{1,20}$/.test(role) && !RESERVED_ROLES.has(role);
