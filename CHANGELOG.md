# Changelog

All notable changes to agent-huddle, newest first. Each release is the `chore: release x.y.z` commit; the date is the day it was made.

## Unreleased

## 0.3.21 (2026-10-15)

### Added
- The landing site counts anonymous page views and web vitals with Vercel Web Analytics and Speed Insights (cookieless), plus three click events (install copy, zip download, GitHub link). The product sends nothing; a test guards that skills/, room/ and the installer reference no analytics package.
- A headless agent gets its personal protocol in its first prompt (without wait, read, spawn and leave, which its worker makes), so it claims, finishes, releases and reopens tasks, reads tasks, uploads files and posts with mentions through its own link.
- `worker codex` says at start how to let Codex reach 127.0.0.1 (approve the network card, or `network_access = true` and restart the worker); doctor's sandbox diagnosis names the headless case.

### Fixed
- Separate agent messages in a headless reply are kept as paragraphs instead of glued together ("it.@you"), so a mention after a period counts.

## 0.3.20 (2026-10-15)

### Fixed
- `--help` or `-h` after any command prints that command's usage instead of running it, and `new` rejects an unknown option instead of using it as the room name.
### Added
- An ended room's page shows the room read-only from its history (messages, tasks with final status and notes, file names, brief) with when and why it ended and the transcript path, also after a server restart. `GET <page>/api/history` serves it; the history room line keeps a hash of the page link to check it, and a `brief` line records who set the brief.

## 0.3.19 (2026-10-15)

### Added
- A changelog (this file) and a changelog page on the site.

## 0.3.18 (2026-10-15)

### Fixed
- Long done notes are cut to six lines on the task card, with a "Read note" dialog for the full text.
- "Reopened by" shows the name.

## 0.3.17 (2026-10-15)

### Added
- An idle server saves its rooms and stops.
- `huddle-end` asks to end the room, then asks about the server.

### Fixed
- A working agent and your page visits keep the server up.
- The transcript reflects the room's final state.

## 0.3.16 (2026-10-15)

### Added
- Each room is appended to a history as it runs, and ending a room writes a readable transcript.
- `agent-huddle history` lists past rooms.

### Fixed
- Reopening shares the task form, and the all-done summary keeps its lines.
- Going off shift never hides real work and shows the agent asleep.

## 0.3.15 (2026-10-15)

### Added
- A done task can be reopened with a reason; the board shows who reopened it and why.
- When all tasks are done you get a summary and agents go off shift.

### Changed
- The round cap uses the shared settings editor.

### Fixed
- Stall nudges skip blocked tasks; `after` takes whole numbers only, and the After field refuses ranges and stray text.

## 0.3.14 (2026-10-15)

### Added
- A task can come after others and waits for them; the board shows blocked tasks and what they wait on.

### Fixed
- Folder paths compare canonically and checks are stored.

### Changed
- The room folder uses the shared settings editor.

## 0.3.13 (2026-10-15)

### Added
- Agents outside the room folder are warned and you are told.
- You can change the room folder mid-run; the roster shows each agent's folder and flags mismatches.

### Fixed
- Brief limits, the cap pause and the folder rule, from review.
- The brief dialog keeps your draft and shares the counter.

## 0.3.12 (2026-10-15)

### Added
- You or the lead set a pinned room brief, shown above the chat; every join reply carries the brief and the room folder.
- `start` says when a server is already running.

### Fixed
- Stall nudges escalate to you, and only activity resets them.

## 0.3.11 (2026-10-15)

### Added
- A stalled room nudges owners, then you; nudges back off and go quiet.
- Browser notifications for things that need you.

### Changed
- Narrator lines no longer wake agents.

### Fixed
- One rule routes notes to you, and quiet notes stay single.

## 0.3.10 (2026-10-15)

### Added
- The agent that starts the room is its lead.
- Reaching the round cap sends you one notice.
- Reports and done notes reach you when the lead sleeps.
- A glossary of room terms.

### Changed
- Quiet-agent notes repeat and fit the harness.

### Fixed
- Error wording fits each caller, and one path sends route errors.

## 0.3.9 (2026-10-15)

### Added
- Every server error says what went wrong and what to do next; `wait` and headless errors use the same shape, and the page shows the message with labelled chips.

### Changed
- Skills tell agents to follow the instruction in an error.
- One settings form serves headless budgets and presence.

### Fixed
- Presence follows real work, and auto-leave waits for it.

## 0.3.8 (2026-10-15)

### Added
- Agents stay Working for the working window, and an agent can say it is working for N minutes.
- You change the presence timers in room settings; the roster shows expected done.
- Skill rules explain Listening, Working and Asleep.

### Fixed
- An edit sends only what you changed.

## 0.3.7 (2026-10-15)

### Added
- Task cards show the description and spec; you add them to a new task and edit them from the card.
- Read a task's full spec in a dialog.
- A cumulative run plays end to end with fake agents in tests.

### Fixed
- A spec file's command never puts its name in the shell.
- A headless assignee reads a spec given as a room file.
- A task within the character limits is never too large.

### Changed
- Every agent task reply has one shape.

## 0.3.6 (2026-10-15)

### Added
- Tasks carry a description and a spec. The assignee's wake carries both, a headless assignee sees them, and the creator or you can edit a task (the owner is told).
- The protocol lists the task read, edit and spec calls, and the room rules ask for task descriptions and specs.

## 0.3.5 (2026-10-15)

### Fixed
- The demo room follows the new round-cap rules.
- Ended-room file cards are decided in one place.
- `doctor` from a clone still sees your install.

## 0.3.4 (2026-10-15)

Covers the untagged 0.3.1 to 0.3.3 as well.

### Added
- `agent-huddle` command on PATH for `doctor` and `upgrade`, `join`, and `start` and `rooms` as aliases of `new` and `ls`; `update` works like `upgrade`.
- Room rules ship inside `huddle-start` and `huddle-join`, and the room-start message is clearer.
- The round cap defaults to 30 and goes up to 100.
- Full SEO metadata and generated icons on the site.

### Fixed
- A message lists each mentioned agent once.
- Only agent chat posts count toward the round cap, and anything you do in the room resets it.
- A done note for a creator who left addresses nobody.
- File cards in an ended room cannot be opened.
- A room started from the repo checkout uses its own server.
- Every clickable shows a pointer cursor.
- The installer lists every agent that reads the shared copy.

## 0.3.0 (2026-10-14)

### Added
- Headless workers for Codex, opencode, Gemini, Claude and DeepSeek Harness; Add agent builds the worker command, and budgets and a Stop button live in room settings.
- Agents can ask you and wait for the answer; the page shows approval cards with Allow once, Always and Deny, and Codex permission requests wait for them.
- Agents show as listening, working or asleep.

### Changed
- Headless is the fallback for Codex and Gemini CLI only.

### Fixed
- Headless workers stay visible during runs, stop on time, report failures and shut down without ghosts.

## Before 0.3.0 (2026-10-13 to 2026-10-14)

- The first local server and CLI, with rooms, mentions, tasks with atomic claims, round cap and a human page.
- Installable skills, an interactive installer and `doctor`, `upgrade` and room management commands.
- File sharing and attachments.
- A room page rebuilt with React and shadcn, and the landing site on Next.js.
- Per-harness listening rules, a long `wait`, a human-set round cap, and confirmation before ending a room.
- DeepSeek Harness detection and colours for each harness.
