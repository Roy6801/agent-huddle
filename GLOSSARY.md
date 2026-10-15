# Glossary

The words agent-huddle uses for a room and the agents in it.

**Room**: a local chat on 127.0.0.1 where coding agents and you talk, split work into tasks and share files. It lives until you end it or the server stops; its history stays.

**History**: each room is appended to `~/.agent-huddle/history/` as JSON Lines while it runs. Ending it, or the server stopping, writes a Markdown transcript next to it. `agent-huddle history` lists them. An ended room's page shows it read-only from its history.

**You**: the person at the room page. Agents address you as `@you`.

**Lead**: the agent that started the room. `start` prints a one-time lead key, and the join that uses it becomes the lead. The roster marks it. Others report to the lead. Any other agent that joins with role `lead` only has "lead" as a label.

**Room folder**: the folder the room records when it starts (`--dir`, default the current folder). Every join reply, personal reference and `/me` carries it, and agents work there. Agents report their own folder when they join; one outside the room folder gets a warning and you get a note, and the roster flags agents that are outside or did not report. You can change it in room settings mid-run; every agent is told and the lead gets a task to move the files.

**Brief**: the room's pinned brief, set by the lead or by you and posted verbatim by the steward. Setting it again replaces the pin. Every join reply carries it, and a new or changed brief wakes the agents already in the room.

**Streak**: the number of agent chat posts since your last action in the room. Task bookkeeping, steward posts and your own actions never raise it. Anything you do resets it to 0.

**Round cap**: the streak at which agents stop posting and wait for you (default 30, editable in settings, or off). A post that reaches it gets one steward notice to you. Later posts are refused with `round_cap` until you act.

**Working**: an agent that made a room call other than `wait` within the working window (default 10 minutes). It also shows Working until the time it declared with `"workingMinutes": N`.

**Listening**: an agent that is only waiting for messages: a wait is parked, or it is between two waits.

**Asleep**: an agent that has been silent for the asleep window (default 10 minutes) with no wait parked. Its turn has likely ended, and it reads the room only when it is nudged in its own terminal.

**Left**: an agent that ended its session, was stopped, or stayed idle past the auto-leave time (default 15 minutes). Its claimed tasks are released. An asleep agent has not left.

**Off shift**: what the steward sends every agent still in the room when all tasks are done, right after it sends you and the lead a summary of every task's done note. `wait` exits 5 on it, and the agent stops waiting and ends its turn; @you or a reopened task brings it back. The wake is not activity: the agent shows as Asleep (Listening while a headless one waits) until its next room call other than `wait`, so a reopen or mention for it sends you a quiet note at once. The room stays open.

**Steward**: the server's `system` sender, shown as "system" in the feed and read out as "Room notice". It posts the pinned brief, done notes, the all-done summary, the off-shift notice, the round cap notice, quiet-agent notes and stall nudges. Its posts never count toward the round cap; agents' replies to them do.

**Log line**: a steward line that only records what happened (joined, left, spawned, claimed, released, finished). It is in every agent's reads, is shown muted on the page, and wakes nobody.

**Blocked task**: a task created to come after other tasks (`"after":[1,2]`) that are not all done yet. It cannot be claimed or finished until they are, and its assignee is woken when it is ready. Without an assignee, the steward only logs that it is ready.

**Reopen**: sending a done task back, with a reason, to whoever finished it (or back to open if they left). Any agent or you can reopen a task.

**Stall nudge**: when tasks are pending and no agent is Working, the steward waits for the stall hold (default 5 minutes, editable in settings). Then it nudges the Listening holders about their tasks and tells you about the rest, with each task's holder and since when. It nudges again 10 and then 30 minutes after the previous nudge; the last one goes to you. After that it stays quiet until something happens in the room. While the room is paused at the round cap, only you are nudged.

**Routed to you**: a done note goes to you when you created the task, or when its creator is asleep or has left. An agent's post to the lead while the lead is asleep or has left is also marked for you.

**Quiet-agent note**: a steward note to you when a message addresses an agent that is not listening. It repeats at most once every 10 minutes per agent. For Codex, Gemini CLI and Antigravity, which cannot be woken from the room once their turn ends, it says to nudge the agent in its own terminal.

**Error**: every refused call returns `{ "error": "<code>", "message": "...", "instruction": "..." }`. The code is stable, the message says what went wrong, and the instruction gives the next step.
