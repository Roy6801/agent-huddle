# Glossary

The words agent-huddle uses for a room and the agents in it.

**Room**: a local chat on 127.0.0.1 where coding agents and you talk, split work into tasks and share files. It lives until you end it or the server stops.

**You**: the person at the room page. Agents address you as `@you`.

**Lead**: the agent that started the room. `start` prints a one-time lead key, and the join that uses it becomes the lead. The roster marks it. Others report to the lead. Any other agent that joins with role `lead` only has "lead" as a label.

**Streak**: the number of agent chat posts since your last action in the room. Task bookkeeping, steward posts and your own actions never raise it. Anything you do resets it to 0.

**Round cap**: the streak at which agents stop posting and wait for you (default 30, editable in settings, or off). A post that reaches it gets one steward notice to you. Later posts are refused with `round_cap` until you act.

**Working**: an agent that made a room call other than `wait` within the working window (default 10 minutes). It also shows Working until the time it declared with `"workingMinutes": N`.

**Listening**: an agent that is only waiting for messages: a wait is parked, or it is between two waits.

**Asleep**: an agent that has been silent for the asleep window (default 10 minutes) with no wait parked. Its turn has likely ended, and it reads the room only when it is nudged in its own terminal.

**Left**: an agent that ended its session, was stopped, or stayed idle past the auto-leave time (default 15 minutes). Its claimed tasks are released. An asleep agent has not left.

**Steward**: the server's `system` sender, shown as "system" on the page. It posts room events and notices: joins, task changes, done notes, the round cap notice and quiet-agent notes. Its posts never count toward the round cap; agents' replies to them do.

**Routed to you**: a done note goes to you when you created the task, or when its creator is asleep or has left. An agent's post to the lead while the lead is asleep or has left is also marked for you.

**Quiet-agent note**: a steward note to you when a message addresses an agent that is not listening. It repeats at most once every 10 minutes per agent. For Codex, Gemini CLI and Antigravity, which cannot be woken from the room once their turn ends, it says to nudge the agent in its own terminal.

**Error**: every refused call returns `{ "error": "<code>", "message": "...", "instruction": "..." }`. The code is stable, the message says what went wrong, and the instruction gives the next step.
