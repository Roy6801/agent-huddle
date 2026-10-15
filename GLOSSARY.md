# Glossary

The words agent-huddle uses for a room and the agents in it.

**Room**: a local chat on 127.0.0.1 where coding agents and you talk, split work into tasks and share files. It lives until you end it or the server stops; its history stays.

**History**: each room is appended to `~/.agent-huddle/history/` as JSON Lines while it runs. Ending it, or the server stopping, writes a Markdown transcript next to it. `agent-huddle history` lists them. An ended room's page shows it read-only from its history.

**Home page**: one page listing your live rooms and past rooms, opened with `agent-huddle home`. Its link carries the home key (`~/.agent-huddle/home-key`, readable only by you); past rooms open from it read-only. It does not start rooms.

**You**: the person at the room page. Agents address you as `@you`.

**In my terminal**: the default way to add an agent. It joins from its own terminal or app with the huddle-join skill or the invite, and you watch and steer it there.

**Headless agent**: the second way to add an agent, side by side with In my terminal: `agent-huddle worker <harness>` runs Claude Code, Codex, Gemini CLI or opencode in the background on your own sign-in, with no chat window. Start one from Add agent → Headless on the page, or run the command yourself. It wakes when addressed, its approvals come to the room page as ask cards, and the roster marks it "headless". Headless is a mark next to its role, not a role, so a headless agent can be the builder too; you can stop it from the roster.

**Lead**: the agent that started the room. `start` prints a one-time lead key, and the join that uses it becomes the lead. Being the lead is a mark, not a role: the roster shows a lead badge, `@lead` always reaches it, and its role is `lead` unless it joined with or took another. Others report to the lead. Any other agent that joins with role `lead` only has "lead" as a label.

**Role**: a free label such as `builder` or `tester`, so `@builder` reaches every agent holding it. An agent gets it from its join line (`/huddle-join <url> as builder`, `join --role`, `worker --role`) and can change it later (`role <link> <role>`, `POST <link>/role`); you can set any agent's role from the page. Each change posts a steward line.

**Room folder**: the folder the room records when it starts (`--dir`, default the current folder). Every join reply, personal reference and `/me` carries it, and agents work there. Agents report their own folder when they join; one outside the room folder gets a warning and you get a note, and the roster flags agents that are outside or did not report. The lead confirms it with you before agents join. You can change it in room settings; every agent is told, and once other agents have joined or a task exists, the lead gets a task to move the files.

**Worktree per agent**: a room setting, off by default, that you turn on from the page's settings when the room folder is in a git repository. Each agent that joins after that gets its own git worktree of that repository, outside it under the huddle home (`worktrees/<room>/<handle>`), on a new branch `huddle/<room>/<handle>` from the current commit; spawned agents share their parent's. Its join reply, personal reference and `/me` carry the worktree's `path` and `branch`, headless agents run there, and the roster shows both. The room folder stays the shared source of truth: agents name their branch in done notes and merge only with your OK. Ending the room never removes worktrees or branches; `agent-huddle end` prints how.

**Brief**: the room's pinned brief, set by the lead or by you and posted verbatim by the steward. Setting it again replaces the pin. Every join reply carries it, and a new or changed brief wakes the agents already in the room.

**Streak**: the number of agent chat posts since your last action in the room. Task bookkeeping, steward posts and your own actions never raise it. Anything you do resets it to 0.

**Round cap**: the streak at which agents stop posting and wait for you (default 30, editable in settings, or off). A post that reaches it gets one steward notice to you. Later posts are refused with `round_cap` until you act.

**Working**: an agent that made a room call other than `wait` within the working window (default 10 minutes). It also shows Working until the time it declared with `"workingMinutes": N`.

**Listening**: an agent that is only waiting for messages: a wait is parked, or it is between two waits.

**Asleep**: an agent that has been silent for the asleep window (default 10 minutes) with no wait parked. Its turn has likely ended, and it reads the room only when it is nudged in its own terminal.

**Left**: an agent that ended its session, was stopped, or stayed idle past the auto-leave time (default 15 minutes). Its claimed tasks are released at once, and one steward line tells you and the lead. An asleep agent has not left.

**Off shift**: what the steward sends every agent still in the room when all tasks are done or cancelled, right after it sends you and the lead a summary of every task's done note. `wait` exits 5 on it, and the agent stops waiting and ends its turn; @you or a reopened task brings it back. The wake is not activity: the agent shows as Asleep (Listening while a headless one waits) until its next room call other than `wait`, so a reopen or mention for it sends you a quiet note at once. The room stays open.

**Steward**: the server's `system` sender, shown as "system" in the feed and read out as "Room notice". It posts the pinned brief, done notes, the all-done summary, the off-shift notice, the round cap notice, quiet-agent notes, stall nudges and freeze watch notes. Its posts never count toward the round cap; agents' replies to them do.

**Log line**: a steward line that only records what happened (joined, left, spawned, claimed, released, finished). It is in every agent's reads, is shown muted on the page, and wakes nobody.

**Blocked task**: a task created to come after other tasks (`"after":[1,2]`) that are not all done yet. It cannot be claimed or finished until they are, and its assignee is woken when it is ready. Without a live assignee, every free agent is offered it (see Free agent), or the steward only logs that it is ready when nobody is free. Only open and claimed tasks are blocked: a done task stays done, and unblocked, when a prerequisite is reopened.

**Free agent**: an agent that holds no claimed task. When a task is ready, unclaimed and has no live assignee (created unassigned, its prerequisites done or cancelled, released, unclaimed or unassigned from the board, reopened, or released when its holder left), the steward offers it to every free agent that is not asleep, except whoever caused it: `Task #5 "title" is ready and unassigned: claim it if you can take it.` A task with a live assignee wakes only the assignee. A free agent does not wait to be assigned.

**Assignment mode**: a room setting, regular (default) or strict, toggled from the page's settings. Regular: a free agent may claim or finish a ready, unclaimed task assigned to someone else; the task moves to it and one steward line tells the previous assignee. A task its assignee releases is offered to free agents. An agent holding a claim is refused (`not_free`) until it finishes or releases it; claiming its own or unassigned tasks is never limited. Strict: only the assignee may claim or finish an assigned task (`not_assignee`); unassigned tasks, and tasks whose assignee left, are open to anyone.

**Reopen**: sending a done task back, with a reason, to whoever finished it (or back to open if they left). A cancelled task reopens as open for its assignee, who is woken. Any agent or you can reopen a task.

**Cancel**: closing a task that is no longer needed without deleting it, so task numbers never shift and history stays readable. You, the task's creator or the lead can cancel an open or claimed task, with an optional reason. A cancelled task counts as finished: tasks waiting only on it are ready and their assignees woken, and the all-done summary lists it apart (`cancelled: #3 "title" by you: reason`). One steward line tells its holder or assignee, its creator and the owners of tasks after it.

**Board actions**: what you can do to any task from its card besides Edit and Reopen: Mark done (note optional; a blocked task cannot be marked done), Unclaim (the holder is released and the task is open again for its assignee), Reassign (to another agent or nobody; a holder other than the new assignee is released) and Cancel task (reason optional; see Cancel). Each posts one steward line that mentions and wakes the agents it affects. A task you mark done shows "by you" in the all-done summary.

**Stall nudge**: when tasks are pending and no agent is Working, the steward waits for the stall hold (default 5 minutes, editable in settings). Then it nudges the Listening holders about their tasks and tells you about the rest, with each task's holder and since when. It nudges again 10 and then 30 minutes after the previous nudge; the last one goes to you. After that it stays quiet until something happens in the room. While the room is paused at the round cap, only you are nudged.

**Freeze watch**: the steward's watch on work held by an agent that stopped. An agent Asleep while holding a claim (not a headless worker's short rest between wakes) is flagged: the roster shows "Asleep holding #N", the task card marks the owner asleep, and one note to you names the tasks, when it went silent, its last post and its declared working window. The room cannot see why: it may be stuck on an approval or a question in its own terminal; for Claude Code and Codex terminals the note suggests page approvals (`approvals on`). Once it has been silent for the release time (default 15 minutes, editable with the presence timers) while still Asleep, the steward releases its claims: each task goes back to open with its assignee kept, and one steward line tells you and mentions the lead and the old owner. In a regular room the task is offered to the free agents (taking it moves the assignee); in a strict room an assigned task stays with its asleep assignee, not offered, until you reassign it from the board. With the default timers an agent is flagged at about 10 minutes of silence, released at 15 and auto-left at about 25. A regular room also offers an assigned, ready task its assignee has not claimed within the stall hold to the free agents, once. Nothing else is unclaimed automatically.

**Routed to you**: a done note goes to you when you created the task, or when its creator is asleep or has left. An agent's post to the lead while the lead is asleep or has left is also marked for you.

**Quiet-agent note**: a steward note to you when a message addresses an agent that is not listening. It repeats at most once every 10 minutes per agent. For Codex, Gemini CLI and Antigravity, which cannot be woken from the room once their turn ends, it says to nudge the agent in its own terminal.

**Ask card**: an approval an agent needs from you, shown on the room page with Allow once, Always (when the harness offers it) and Deny. Headless agents ask this way; Claude Code and Codex in a terminal do too once their session is bound with `approvals on` ("Approvals on the room page" in the README). An unanswered card from a terminal agent goes back to its terminal prompt after 3 minutes; one from a headless agent is denied after 10.

**Error**: every refused call returns `{ "error": "<code>", "message": "...", "instruction": "..." }`. The code is stable, the message says what went wrong, and the instruction gives the next step.
