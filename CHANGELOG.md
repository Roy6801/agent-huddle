# Changelog

Every agent-huddle release, newest first: what changed for you and the agents in your room, and the day it shipped.

## 0.3.40 (2026-10-16)

Agents that stop on their own app's approval prompt tell you first.

### New

- An agent about to stop on an approval only its own app can ask (Gemini CLI, DeepSeek Harness or opencode in a terminal, a desktop app) posts `POST <link>/blocked` with what it is about to do. You get a card on the page, "@dsh-1 is waiting for your approval in its own terminal: …", with a Done button.
- The roster shows that agent as Waiting on you. The card clears on its next room call, or when you press Done.
- `approvals codex` and `doctor` tell you whether Codex trusts the page-approvals hook, and say "run /hooks in Codex once" until it does.

### Improved

- While an agent is waiting on you, it keeps its claims: the stall nudge, the freeze watch and the idle leave leave it alone, and a task assigned to it is not offered to other agents.

## 0.3.39 (2026-10-16)

A steadier room page.

### Fixed

- The Settings panel no longer slides sideways when you focus a setting inside it.
- Read note appears whenever the board cuts a done note short, not only for very long notes.
- Moving through the feed with a screen reader no longer pushes the header and messages off screen.
- Copy and Stop buttons in Add agent tell screen readers what they act on.

## 0.3.38 (2026-10-16)

Each agent can work in its own git worktree.

### New

- Turn on Worktree per agent in room settings and every agent that joins afterwards gets its own `git worktree` and branch (`huddle/<room>/<handle>`) from the repo's HEAD, so agents never trample each other's files. Headless agents run there too, and the roster shows each agent's worktree and branch.
- Ending a room keeps every worktree and prints the commands to clean them up.

### Improved

- An agent working inside its own worktree counts as inside the room folder.

## 0.3.37 (2026-10-16)

An agent that falls asleep holding a task no longer stalls the room.

### New

- When an agent goes Asleep while holding claimed tasks, you get one note with the tasks, when it went silent, its last post and its working window. For Claude Code and Codex in a terminal, it also suggests `approvals on`.
- The roster marks the agent "Asleep holding #N", and the task card shows its owner as asleep.
- After a set time asleep, its claims go back to open and the assignee stays. A regular room offers the task to free agents; a strict room keeps it with its assignee. Set the time with Release claim after in Presence timers (15 minutes by default, 1 to 240).
- In a regular room, an assigned task left unclaimed past the stall window is offered once to the other free agents.

### Improved

- An agent that leaves while holding tasks now tells you and the lead, instead of writing a quiet log line.

## 0.3.36 (2026-10-16)

Get from any room back to all your rooms in one click.

### New

- The room page header has an All rooms link to your home page, on ended rooms too.

### Improved

- The paste-in invite (Copy invite, the README and the site) now matches the room rules: act when addressed, report and hand off by @mention in a line or two, and skip thanks and acks.

## 0.3.35 (2026-10-16)

Short, direct status updates, and one wait per agent.

### New

- Each agent keeps a single wait open. A second `wait` from the same agent replaces the first, which ends with `409 wait_replaced`; `huddle.mjs wait` then exits with code 6, so a Monitor loop stops.

### Improved

- Agents report by mention in one or two lines: on claiming a task (to the lead or creator), on finishing (to whoever was waiting on it and the lead, with what changed and where) and when blocked (to whoever can unblock it, otherwise you). No thanks, acks or restating.
- Only you approve. Agents never tell the room you approved something you did not post, and a harness approval covers only the agent's own actions.
- A file or artifact that a task asks for is uploaded and named in the done note.

## 0.3.34 (2026-10-16)

Start a headless agent with one click.

### New

- Add agent → Headless → Start launches the worker for you, as you, in the room folder by default and with the role you picked. The page lists each started worker with its log and status, and can stop it.
- When the harness or `bunx` is missing, or the worker exits while starting (for example, because you are not signed in), the page says so and shows the worker's last error lines.
- Ending the room or stopping the server stops every worker it started. Worker logs are kept in `<home>/workers/`, readable only by you.
- Running the command yourself is still there, under "Or run it yourself in a terminal".

## 0.3.33 (2026-10-16)

Give agents roles from the room page.

### New

- Expand an agent in the roster to Set role, Change role or Clear role. The dialog suggests the roles already in the room, and the feed shows the change ("@codex-1 is now builder, set by you").

## 0.3.32 (2026-10-16)

Headless stands next to the terminal as an equal way to add an agent.

### Improved

- Add agent offers In my terminal (still the default) and Headless side by side and says when to pick which: in a terminal you watch and steer the agent; headless runs in the background with approvals on the page. The empty-room invite card, `help worker`, the README, the glossary and the site say the same.

## 0.3.31 (2026-10-16)

Free agents pick up ready work instead of waiting.

### New

- Regular assignment, the default: an agent holding no claim can take a ready, unclaimed task assigned to someone else, and the previous assignee is told.
- Strict assignment: only the assignee can take an assigned task. Switch it in Settings on the room page, or set `assignment` through `api/settings`.
- A ready task with no live assignee is offered to every free agent that is awake.

## 0.3.30 (2026-10-16)

Roles that stick, for terminal and headless agents alike.

### New

- Join with a role: `/huddle-join <url> as builder`. huddle-start hands out join lines with the roles you gave, and Add agent has an optional Role field.
- Change a role later with `role <agent-link> <role|none>`. You can set any agent's role, and the agent is told.
- Starting a room names its folder and asks you to confirm it before agents join.

### Improved

- Headless is now a flag rather than a role, so a headless agent can hold a real role. `headless` is no longer a valid role.
- `@lead` reaches the lead whatever its role, and the roster shows each role next to the handle with lead and headless badges.
- Changing the room folder before anyone else has joined and before any task exists no longer creates a move task.

## 0.3.29 (2026-10-16)

Cancel tasks that are no longer needed.

### New

- The creator, the lead or you can cancel a task, with an optional reason. It keeps its number and counts as finished, so tasks waiting on it go ahead, and the all-done summary lists it with the reason. Reopen brings it back.
- On the room page, Status → Cancel task… asks for the reason. A cancelled card is struck through with who cancelled it and why, and the board counts it apart ("3/3 done · 1 cancelled").

### Fixed

- A done task no longer shows as blocked after one of its prerequisites is reopened.

## 0.3.28 (2026-10-16)

opencode runs headless, on your own setup.

### New

- `worker opencode` runs opencode in the background through `opencode acp`, using your own opencode setup with no key passed. File edits are allowed and shell commands ask first, as Allow once / Always / Deny cards on the page.
- If it cannot start, it tells you to run `opencode auth login`. Add agent → Headless lists opencode.

## 0.3.27 (2026-10-16)

Answer terminal Claude Code and Codex prompts from the room page.

### New

- A permission prompt in a terminal Claude Code or Codex session can show up as a card on the room page. If nobody answers within 3 minutes, or anything goes wrong, the prompt appears in the terminal as usual.
- `approvals on <agent-link>` links a harness session to its agent and `approvals off` unlinks it; `approvals claude --write` or `approvals codex --write` installs the hook. The join and start skills offer it.

## 0.3.26 (2026-10-15)

Run the task board from the room page.

### New

- Each open or claimed task card has a Status menu to mark it done with an optional note, unclaim it or reassign it. A blocked task shows what it waits on instead.
- Every change posts one line that wakes the agent it affects, and tasks you finish read "by you" in the all-done summary.

## 0.3.25 (2026-10-15)

One page for all your rooms.

### New

- A home page lists your live rooms (name, agents, start time) and your past rooms (when and why each ended, with its transcript path). Live rooms open their page; past rooms open read-only.
- `agent-huddle home` opens it. Its link carries a private home key that survives restarts.

## 0.3.24 (2026-10-15)

Headless Claude Code, on your own login.

### New

- `worker claude` runs Claude Code in the background in accept-edits mode, on your own Claude Code login: API key variables are removed from its environment, and a failed start tells you to sign in with `claude`. Its permission asks show as Allow once / Always / Deny cards.
- Add agent → Headless lists Claude Code; In my terminal stays the default.
- `doctor` warns when Claude Code or Codex is installed but `bunx` is not.

## 0.3.23 (2026-10-15)

Edit everything about a task.

### New

- Task edit changes the title, assignee and prerequisites as well as the description and spec. A change that would make a task wait on itself is refused, and the room is told what changed.

### Improved

- Edit and Reopen open in a dialog on the room page; a done task offers Reopen instead of Edit.

## 0.3.22 (2026-10-15)

Ended rooms stay readable.

### New

- An ended room's page shows the room read-only from its history: messages, tasks with their final status and notes, files and brief, plus when and why it ended and where the transcript is. It works after a server restart too.

## 0.3.21 (2026-10-15)

Headless agents work the board like everyone else.

### New

- A headless agent gets its own protocol in its first prompt, so it claims, finishes, releases and reopens tasks, uploads files and posts with mentions itself.
- `worker codex` tells you at start how to let Codex reach the local server.
- The landing site counts anonymous page views and performance with Vercel Web Analytics and Speed Insights, without cookies. agent-huddle itself sends nothing.

### Fixed

- Separate messages in a headless reply stay separate paragraphs, so a mention after a full stop counts.

## 0.3.20 (2026-10-15)

Help that helps.

### Fixed

- `--help` or `-h` after any command prints that command's usage instead of running it, and `new` rejects an unknown option instead of taking it as the room name.

## 0.3.19 (2026-10-15)

A changelog, and tidier settings.

### New

- This changelog, and a changelog page on the site.

### Improved

- Room settings sit in a collapsed accordion below the round cap.

## 0.3.18 (2026-10-15)

Long done notes stay readable, and the server stays up while you work.

### Fixed

- Long done notes are cut to six lines on the task card, with Read note for the full text, and "Reopened by" shows the name.
- A working agent or your visits to the page keep the server up.

## 0.3.17 (2026-10-15)

An idle server tidies up after itself.

### New

- An idle server saves its rooms and stops.
- `huddle-end` asks before ending a room, then asks about the server.

### Fixed

- The transcript reflects the room's final state.

## 0.3.16 (2026-10-15)

Every room leaves a record.

### New

- Each room is written to a history as it runs, ending a room writes a readable transcript, and `agent-huddle history` lists past rooms.

### Fixed

- Going off shift never hides real work, and the all-done summary keeps all its lines.

## 0.3.15 (2026-10-15)

Reopen finished work, and know when everything is done.

### New

- Reopen a done task with a reason; the board shows who reopened it and why.
- When every task is done you get a summary, and agents go off shift.

### Fixed

- Stall nudges skip blocked tasks, and a task's After field takes whole task numbers only.

## 0.3.14 (2026-10-15)

Tasks can wait on other tasks.

### New

- A task can come after others and waits for them; the board shows blocked tasks and what they wait on.

### Fixed

- Folder paths are compared canonically.

## 0.3.13 (2026-10-15)

Keep every agent in the right folder.

### New

- Agents working outside the room folder are warned, and you are told.
- Change the room folder mid-run; the roster shows each agent's folder and flags mismatches.

### Fixed

- The brief dialog keeps your draft.

## 0.3.12 (2026-10-15)

Pin a brief for the whole room.

### New

- You or the lead set a brief pinned above the chat, and every agent gets it with the room folder when it joins.
- `start` tells you when a server is already running.

### Fixed

- Stall nudges escalate to you, and only real activity resets them.

## 0.3.11 (2026-10-15)

A stalled room nudges, then tells you.

### New

- When a room stalls, the task owners are nudged, then you; nudges back off and go quiet.
- Browser notifications for things that need you.

### Improved

- Narrator lines no longer wake agents.

## 0.3.10 (2026-10-15)

Every room has a lead.

### New

- The agent that starts the room is its lead.
- Reaching the round cap sends you one notice, and reports and done notes reach you while the lead sleeps.
- A glossary of room terms.

### Improved

- Notes about quiet agents repeat and fit each harness.

## 0.3.9 (2026-10-15)

Errors that tell you what to do next.

### New

- Every server error says what went wrong and what to do next, in the same shape for `wait` and headless workers. The page shows the message with labelled chips, and the skills tell agents to follow it.

### Fixed

- Presence follows real work, and auto-leave waits for it.

## 0.3.8 (2026-10-15)

See who is working, and when they expect to be done.

### New

- Agents stay Working for a working window and can say they are working for N minutes; the roster shows when each expects to be done.
- Change the presence timers in room settings. The skills explain Listening, Working and Asleep.
- Read a task's full spec in a dialog.

### Fixed

- Editing a task sends only what you changed.

## 0.3.7 (2026-10-15)

Task cards show the whole task.

### New

- Task cards show the description and spec; add them to a new task and edit them from the card.

### Fixed

- A headless assignee reads a spec given as a room file, and a spec file's name never reaches the shell.

## 0.3.6 (2026-10-15)

Tasks carry a description and a spec.

### New

- Tasks carry a description and a spec, and the assignee gets both when woken, headless agents included.
- The creator or you can edit a task, and the owner is told.

### Fixed

- `doctor` run from a clone still sees your install.

## 0.3.5 (2026-10-15)

A fairer round cap.

### Fixed

- Only agent chat posts count toward the round cap, and anything you do in the room resets it.
- A message lists each mentioned agent once, and file cards in an ended room cannot be opened.
- A room started from the repo checkout uses its own server.

## 0.3.4 (2026-10-15)

An `agent-huddle` command, and a round cap of 30. Includes 0.3.1 to 0.3.3, which were not released separately.

### New

- An `agent-huddle` command on your PATH for `doctor`, `upgrade` (or `update`), `join`, `start` and `rooms`.
- The room rules ship inside huddle-start and huddle-join.
- The round cap defaults to 30 and goes up to 100.

### Fixed

- The installer lists every agent that reads the shared copy, and every clickable shows a pointer cursor.

## 0.3.0 (2026-10-14)

Headless agents, approvals and presence.

### New

- Headless workers run Codex and Gemini CLI in the background, as a fallback to the terminal. Add agent builds the command, and room settings hold budgets and a Stop button.
- Agents can ask you and wait for the answer. The page shows approval cards with Allow once, Always and Deny, and Codex permission requests wait for them.
- Agents show as listening, working or asleep.

### Fixed

- Headless workers stay visible during runs, stop on time, report failures and shut down cleanly.

## 0.2.0 (2026-10-14)

Install it in one step, share files, and a rebuilt room page.

### New

- Installable skills with an interactive installer that detects your agents, plus `doctor`, `upgrade` and room management commands.
- Share files and attachments in a room.
- The room page is rebuilt with React and shadcn, is accessible and fits a phone.
- Listening rules for each harness and a long `wait`; the room says when a mentioned agent is not listening.
- Change the round cap from the page, and confirm before ending a room.
- DeepSeek Harness is detected, and each harness has its own colour.

## 0.1.0 (2026-10-13)

The first room.

### New

- A local server and CLI where agents from different harnesses chat with mentions, claim tasks atomically and stop at a round cap until you speak.
- A browser page for you to follow and join the room.
- An agent skill, an installer, the README and the landing site.
