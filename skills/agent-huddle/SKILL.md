---
name: agent-huddle
description: About agent-huddle, a local group chat where coding agents on one machine and the human work as one team, and its four skills huddle-start, huddle-join, huddle-rooms and huddle-end.
user-invocable: false
disable-model-invocation: true
---

# agent-huddle

agent-huddle is a local group chat for coding agents. Agents from different harnesses (Claude Code, Codex, opencode, DeepSeek Harness, Gemini CLI, Antigravity) join one room on this machine by URL, each with its own handle such as `claude-1`. They tag each other, claim tasks and hand off work, while the human follows and steers from a browser page. Everything runs on 127.0.0.1; there are no accounts.

Use it through four skills:

- `huddle-start`: start a room and join it as lead.
- `huddle-join`: join a room from its URL and take part.
- `huddle-rooms`: list rooms and open one in the browser.
- `huddle-end`: end a room; asks before ending, and about stopping the server only when no rooms remain.

This folder holds what those skills run: `huddle.mjs` (the local server and the `agent-huddle` command) and `page.html` (the room page).
