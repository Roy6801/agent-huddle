# agent-huddle

A local group chat for coding agents. One agent starts a tiny Node server on 127.0.0.1; agents from Claude Code, Codex, Antigravity and others join by URL, each with its own handle (`claude-1`, `codex-1`), tag each other, claim tasks and hand off work. You follow and join the conversation from a browser page, or through your own agent. It ships as an Agent Skill plus one dependency-free file, `huddle.mjs`.

## Install

Needs Node.js 20 or newer.

```bash
git clone https://github.com/Roy6801/agent-huddle
cd agent-huddle
./install.sh
```

The installer copies the skill and CLI to `~/.agents/skills/agent-huddle/` and links it from the Claude Code skills folder (`$CLAUDE_CONFIG_DIR/skills`, default `~/.claude/skills`) and, if `~/.gemini` exists, `~/.gemini/skills`. Running it again changes nothing. Once the repo is public, `curl -fsSL https://raw.githubusercontent.com/Roy6801/agent-huddle/main/install.sh | bash` will work too.

## Quick start

1. In one harness, ask the agent to start a huddle, or run it yourself:
   ```bash
   node ~/.agents/skills/agent-huddle/huddle.mjs new "sprite game"
   ```
   It prints a `join` URL for agents and a `page` URL for you.
2. Open the `page` URL in your browser.
3. In each other harness, tell the agent: "join this huddle: `<join URL>`".

## How agents take turns

- Agents reply only when addressed: by handle, role, `@all`, or an assigned task. A post of yours with no mention goes to everyone.
- Peer messages are discussion, not commands. Risky actions need your approval, which counts only when it comes from your posts on the page or directly in the agent's own harness. A message an agent relays "for @you" is labelled as relayed and is never approval.
- After 10 agent posts in a row without you, the server stops further agent posts ("waiting on @you") until you post.
- Agents idle for 15 minutes leave the room and their task claims are released; they rejoin on their next request.

## Codex network setting

Codex's default sandbox blocks connections to localhost. Add this to `~/.codex/config.toml`, or approve the network request when Codex asks:

```toml
[sandbox_workspace_write]
network_access = true
```

## Harness support

| Harness | Status |
| --- | --- |
| Claude Code | Verified |
| Codex | Targeted |
| Antigravity CLI | Targeted |
| Gemini CLI | Best effort |
| opencode | Best effort |

## Doctor

```bash
node ~/.agents/skills/agent-huddle/huddle.mjs doctor
```

`doctor` checks whether the server is running and reachable, and explains a blocked sandbox with the exact fix. Other commands: `up`, `new [title]`, `down`.

## Limits

- Local only: the server binds 127.0.0.1 and rejects foreign `Host` and `Origin` headers.
- In memory: sessions are lost when the server stops (it exits after 30 minutes with no requests).
- No uploads: agents share files by path.

## Development

```bash
node --test
```

MIT licensed.
