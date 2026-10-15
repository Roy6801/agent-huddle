# Changelog

All notable changes to agent-huddle, newest first. Each release is the `chore: release x.y.z` commit; the date is the day it was made.

## 0.3.38 (2026-10-16)

Each agent can work in its own git worktree.

### New
- **Worktree per agent.** Turn it on in room settings and every agent that joins afterwards gets its own `git worktree` and branch (`huddle/<room>/<handle>`) from the repo's HEAD, so agents never trample each other's files. Headless agents run there too, and the roster shows each agent's worktree and branch.
- Ending a room keeps every worktree and prints the commands to clean them up.

### Improved
- An agent working inside its own worktree counts as inside the room folder.

## Unreleased

## 0.3.37 (2026-10-16)

### Added
- Freeze watch. Presence timer `releaseMinutes` (default 15, 1-240; POST `api/settings`, in `presenceTimers` and the settings line). An agent Asleep holding claims (outside a headless worker's rest window) gets `asleepHolding: [n]` in `who`/`api/state` and one steward note to you with the tasks, when it went silent, its last post, its working window and, for Claude Code/Codex terminals, the `approvals on` hint. After `releaseMinutes` of silence while Asleep its claims go back to open with the assignee kept; one steward line to you mentions the lead and the old owner; regular rooms offer the task to free agents ("@x fell asleep holding it"), strict rooms keep an assigned task with its assignee. Regular rooms also offer an assigned, ready task left unclaimed for the stall window to free agents other than the assignee, once per task and assignee.
- Page: Release claim after in the Presence timers; roster badge "Asleep holding #N"; "asleep" on the task card's owner.
### Changed
- A leave that releases claims is a steward line to you and the lead instead of a quiet log line.

## 0.3.36 (2026-10-16)

### Changed
- The paste-in invite (Copy invite, README, site How it works) now says to act when addressed and to report and hand off by @mention in 1-2 lines, no thanks or acks, matching the room rules.

### Added
- The room page header has an "All rooms" link to the home page. The server adds `home` (the `/home/<key>` path) to `api/state` and `api/history` for a valid human page key, and to a past room's history opened from the home; agent keys and servers without a home key never get it. Ended rooms keep the link; the site demo has none.

## 0.3.35 (2026-10-16)

### Added
- One wait per agent: a second `GET wait` from the same agent answers the parked one with 409 `wait_replaced` and parks the new one. `node huddle.mjs wait` prints it and exits 6, so a Monitor loop stops; the room rules say to run one wait at a time.

### Changed
- Agents report and hand off by mention: room rules (huddle-start, huddle-join), the personal and room protocol and the headless worker preamble ask for a 1-2 line status on claim (to the lead or creator), done (to the owners of tasks that waited on it, plus the lead: what changed and where) and blocked (to whoever can unblock, else @you), one example each. "No chatter" (no thanks, acks or restating) replaces "post only what moves the work"; round cap rules unchanged.
- Only @you approves: agents never tell the room @you approved something @you did not post; a harness approval covers only the agent's own actions. The Leading section says it for the lead.
- A file or artifact a task asks for is uploaded and named in the done note.

## 0.3.34 (2026-10-16)
### Added
- One-click headless: Add agent → Headless → Start makes the server spawn `huddle.mjs worker <harness> <join> --dir <folder>` itself (`POST <page>/api/workers {harness, folder?, role?}`, page key only; `role` is checked like a join's and passed as `--role`), as the user, in the room folder by default. It answers 201 once the worker is listening, 202 while it is still starting, 424 `worker_unavailable` when doctor's detection finds no `bunx` (Claude Code, Codex) or no harness binary, and 502 `worker_failed` with the worker's last error lines when it exits while starting (for example, not signed in). Output goes to `<home>/workers/<room>-<n>.log` (0600, folder 0700). `api/state` lists `workers` (status, handle, log, error); `POST <page>/api/workers/<n>/stop` sends SIGTERM. Ending the room and server close (`down`, idle stop) stop every started worker and wait up to 5 s before SIGKILL. The copy-a-command option stays under "Or run it yourself in a terminal".

## 0.3.33 (2026-10-16)
### Added
- The room page sets roles: an expanded roster row of an agent still in the room has Set role / Change role, opening a dialog with a field checked like the server (1-20 lowercase letters, digits or dashes), the roles already in the room as one-click suggestions, and Clear role. Server errors show in the dialog's error box; the steward line "@codex-1 is now builder, set by you" appears in the feed. Ended rooms and agents that left have no control; the demo handles it too.

## 0.3.32 (2026-10-16)
### Changed
- Headless is presented as an equal second way to add an agent, next to In my terminal (still the default). Add agent's switch says when to pick which (terminal: you watch and steer it there; headless: runs in the background, approvals on the page); the empty-room invite card, the `new` announce, `help worker`, README, GLOSSARY (In my terminal, Headless agent), the engine skill and the landing site's How it works say the same.

## 0.3.31 (2026-10-16)
### Added
- Free agents pick up work. A room has `assignment: "regular" | "strict"` (POST `api/settings`, shown in `api/state` and `GET me`; 400 `invalid_assignment`). Regular, the default: an agent holding no claim may claim or finish a ready, unclaimed task assigned to someone else; the assignee moves to it and one steward line (`<agent> took task #n "title" from @<assignee>`) mentions and wakes the previous assignee. Taking someone else's task while holding a claim is 409 `not_free`; several claims of your own or unassigned tasks stay allowed. Strict: 403 `not_assignee` for anyone but a live assignee; unassigned tasks and tasks whose assignee left are open to anyone.
- A ready, unclaimed task with no live assignee (created unassigned, prerequisites done or cancelled, released, unclaimed or unassigned from the board, reopened, or released when its holder left) mentions and wakes every free agent that is not asleep, except the actor: `Task #n "title" is ready and unassigned: claim it if you can take it.` A creation folds the offer into its line. A task with a live assignee still wakes only the assignee. The personal reference and the skills room rules tell agents holding no claim to pick up ready work instead of waiting.
- The room page's Settings accordion has a Strict assignment switch with a one-line explanation of the current mode; it saves `assignment` at once and the steward line shows in the feed. The site demo supports it too.

## 0.3.30 (2026-10-16)

### Added

- Roles stick: a join line can end with `as <role>` (`/huddle-join <url> as builder`), huddle-join joins with it, huddle-start hands out lines with the roles the user gave, and Add agent on the page has an optional Role field for the skill lines and the headless command (`worker --role`).
- Role change: `POST <link>/role {"role":…}` (null clears) and CLI `role <agent-link> <role|none>`, with the steward line "codex-1 is now builder"; `POST <page>/api/agents/<handle>/role` lets @you set any agent's role, and its line mentions and wakes the agent. Changes are written to history; the personal protocol and room rules document them.
- The `new` reply carries `folder`, and the announce names the room folder and asks to confirm it before agents join; huddle-start confirms it with the user.

### Changed

- Headless is a flag (`headless: true` in who, state and history), not a role, so a headless agent can hold a real role. Joins with role `headless` still set the flag; `headless` is no longer a valid role.
- `@lead` reaches the lead whatever role it holds; the roster shows the role next to the handle with lead and headless badges.
- A room folder change before any agent but the lead has joined and before any task creates no move task.

## 0.3.29 (2026-10-16)

### Added

- Tasks can be cancelled (`POST <link>/tasks/<n>/cancel` for the creator or the lead, `POST <page>/api/tasks/<n>/cancel` for you; optional `reason`). The task keeps its number with status `cancelled` and `cancelled: {by, reason, at}`; it counts as finished, so tasks waiting only on it are announced ready and woken, and the all-done summary fires and lists it as `cancelled: #n "title" by <who>: <reason>`. One steward line mentions and wakes the holder or assignee, the creator and the owners of tasks after it. Reopen takes a cancelled task back to open for its assignee. New errors `not_canceller` (403) and `task_cancelled` (409); `not_done` now reads "not done or cancelled". The personal reference, skills room rules, history lines and transcript show the status and reason.
- The room page's Status menu has Cancel task…, which asks for an optional reason in a dialog. A cancelled card is muted and struck through like a done one, shows Cancelled by with the reason, and offers Reopen. The board count leaves cancelled tasks out of the total and names them apart ("3/3 done · 1 cancelled").

### Fixed

- A done task no longer reports `blocked` after one of its prerequisites is reopened; only open and claimed tasks are blocked.

## 0.3.28 (2026-10-16)

### Added

- `worker opencode` runs opencode headless through `opencode acp` (its binary found like other harnesses), on the user's own opencode setup: no key is passed, and a failed start says to run `opencode auth login`. `OPENCODE_CONFIG_CONTENT` sets edit to allow and bash to ask, since opencode allows every shell command by default. The worker selects the `build` agent through `session/set_config_option` when an agent offers its mode as a config option. Its asks (once / always / reject) map to Allow once / Always / Deny cards. Add agent → Headless lists opencode. Only DeepSeek Harness is still refused.

## 0.3.27 (2026-10-16)

### Added

- Terminal Claude Code and Codex permission prompts can ask on the room page. `ask-hook claude|codex` is a `PermissionRequest` command hook: it posts an ask card for the agent bound to the hook's `session_id`, long-polls the answer and prints `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"|"deny"}}}` (Claude Code's Always adds the request's `permission_suggestions` as `updatedPermissions` for this session only). Any failure, or no answer within 3 minutes, prints nothing so the terminal prompt shows, and the card is cancelled.
- `approvals on <agent-link> [--session <id>]` / `approvals off` bind a harness session to an agent (`approvals.json`, owner-only; Codex defaults to `CODEX_THREAD_ID`). `approvals claude|codex [--write]` prints or merges the hook into Claude Code `settings.json` or Codex `hooks.json`. The join and start skills and the personal reference of terminal Claude Code and Codex agents offer it.

## 0.3.26 (2026-10-15)

### Added

- The room page can mark a task done (`POST <page>/api/tasks/<n>/done`, note optional, refused while blocked), unclaim it (`/release`; the task stays with its assignee) and reassign it (`/assign` with an agent or null; a different holder is released). Each posts one steward line that mentions and wakes the holder, assignee or creator it affects. A task you finish is owned by `you`, so the all-done summary reads "by you". New errors `not_claimed` and `same_assignee`.
- Each open or claimed task card on the room page has a Status menu (Mark done…, Unclaim, Reassign…); Mark done asks for an optional note and Reassign offers the agents in the room or nobody, each in a dialog. A blocked task says which tasks it waits on instead of offering Mark done.

## 0.3.25 (2026-10-15)

### Added

- A home page lists your live rooms (name, agents, started; each opens its page) and past rooms from history (started, when and why it ended, transcript path with Copy; each opens read-only, also history from before page hashes), newest first. `agent-huddle home [--print]` opens it; its link `/home/<key>` holds a home key kept in `<home>/home-key` (0600, stable across restarts), and a wrong key gets 401 `wrong_home_link`. `GET /` shows only a hint. Lead and agent keys are never listed.

## 0.3.24 (2026-10-15)

### Added

- `worker claude` runs Claude Code headless through `@agentclientprotocol/claude-agent-acp@0.91.0` (bunx) in acceptEdits mode, on the user's own Claude Code login: `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from the adapter's environment, and a failed start says to sign in with `claude` (/login). Its permission asks map to Allow once / Always / Deny cards. Add agent → Headless lists Claude Code; In my terminal stays the default. Only opencode and DeepSeek Harness are still refused.
- `doctor` warns when Claude Code or Codex is installed but `bunx` is not on PATH.

## 0.3.23 (2026-10-15)

### Added

- Task edit accepts `title`, `assignee` and `after` as well as description and spec, with create's validation; a change that would make a task wait on itself (directly or through others) is refused with `after_cycle`. The steward line names what changed and mentions the new assignee (and the previous one while the task is unclaimed).

### Changed

- On the room page, Edit and Reopen open in a dialog. Edit covers title, assignee, after, description and spec; a done task says it cannot be edited and offers Reopen with its reason field.

## 0.3.22 (2026-10-15)

### Added

- An ended room's page shows the room read-only from its history (messages, tasks with final status and notes, file names, brief) with when and why it ended and the transcript path, also after a server restart. `GET <page>/api/history` serves it; the history room line keeps a hash of the page link to check it, and a `brief` line records who set the brief.

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

## 0.3.19 (2026-10-15)

### Added

- The room page's settings sit in a collapsed accordion below the round cap.
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
