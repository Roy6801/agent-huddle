import type { RoomState } from "@/hooks/use-room";
import type { Agent, FileMeta, Message } from "@/lib/types";

/** The site's hero demo: a scripted room that applies the same rules and system lines as huddle.mjs. */

export const ROUND_CAP = 7;

export type Step =
  | { t: "join"; h: string; harness: string; role: string }
  | { t: "spawn"; parent: string; h: string; role: string }
  | { t: "you"; text: string }
  | { t: "post"; h: string; text: string; relay?: boolean; sprite?: boolean }
  | { t: "task"; by: string; title: string; for: string }
  | { t: "claim"; h: string; id: number }
  | { t: "done"; h: string; id: number; note: string };

export const SCRIPT: Step[] = [
  { t: "join", h: "claude-1", harness: "claude", role: "lead" },
  { t: "join", h: "codex-1", harness: "codex", role: "artist" },
  { t: "join", h: "opencode-1", harness: "opencode", role: "levels" },
  { t: "you", text: "Let's build Moonhop, a tiny platformer. @claude-1 you lead." },
  { t: "post", h: "claude-1", text: "@codex-1 you draw sprites better than I do. Can you take the player? 16x16, four frames." },
  { t: "task", by: "claude-1", title: "Draw player sprite", for: "codex-1" },
  { t: "task", by: "claude-1", title: "Lay out level 1", for: "opencode-1" },
  { t: "claim", h: "codex-1", id: 1 },
  { t: "claim", h: "opencode-1", id: 2 },
  { t: "spawn", parent: "claude-1", h: "claude-1.tester", role: "tester" },
  { t: "post", h: "claude-1", text: "@claude-1.tester write a jump-height test for src/player.js." },
  { t: "post", h: "claude-1", relay: true, text: "@all use 16x16 tiles everywhere." },
  { t: "post", h: "opencode-1", text: "@codex-1 can you delete assets/old so the new tiles fit?" },
  {
    t: "post",
    h: "codex-1",
    text: "@opencode-1 deleting files needs approval from @you. A relayed note doesn't count, so assets/old stays.",
  },
  { t: "post", h: "codex-1", text: "@claude-1 player sprite, four frames.", sprite: true },
  { t: "done", h: "codex-1", id: 1, note: "assets/player.png" },
  { t: "post", h: "claude-1.tester", text: "@claude-1 jump test passes: three tiles high." },
  { t: "you", text: "@codex-1 approved: delete assets/old. Nice work, everyone." },
  { t: "post", h: "codex-1", text: "@you done. assets/old is deleted." },
  { t: "done", h: "opencode-1", id: 2, note: "levels/1.json" },
];

/** Steps already applied on first paint, so the room is never empty. */
export const INITIAL_STEPS = 9;

/** Time between the initial steps, which happened before the page opened. */
const HISTORY_GAP = 40_000;

const EMPTY: RoomState = {
  brief: null,
  name: "moonhop",
  joinUrl: "http://127.0.0.1:4747/s/moonhop",
  folder: "/Users/you/code/moonhop",
  worker: "/Users/you/.claude/skills/agent-huddle/huddle.mjs",
  workers: [],
  agents: [],
  tasks: [],
  asks: [],
  messages: [],
  roundCap: ROUND_CAP,
  streak: 0,
  assignment: "regular",
  worktrees: "off",
  headless: { wakesPerHour: 20, runMinutes: 10, idleMinutes: 60 },
  presenceTimers: { workingWindowMinutes: 10, asleepMinutes: 10, leaveMinutes: 15, stallMinutes: 5, releaseMinutes: 15 },
  conn: "live",
  notice: "",
  loaded: true,
  ended: false,
};

const MENTION = /(?:^|\s)@([\w.*-]*[\w*])/g;

export function addMessage(s: RoomState, at: number, from: string, text: string, extra: Partial<Message> = {}): RoomState {
  const mentions = [...text.matchAll(MENTION)].map((m) => m[1]);
  const handles = new Set(s.agents.map((a) => a.handle));
  const m: Message = {
    id: (s.messages.at(-1)?.id ?? 0) + 1,
    at: new Date(at).toISOString(),
    from,
    for: null,
    kind: "chat",
    text,
    mentions,
    to: mentions.includes("all") ? [...handles].filter((h) => h !== from) : mentions.filter((h) => handles.has(h)),
    toYou: from !== "you" && mentions.includes("you"),
    files: [],
    ...extra,
  };
  return { ...s, messages: [...s.messages, m] };
}

export const system = (s: RoomState, at: number, text: string) => addMessage(s, at, "system", text, { kind: "system", mentions: [] });

/** Only agent chat posts count toward the round cap, as on the server. */
export const counts = (step: Step) => step.t === "post";

export const atCap = (s: RoomState) => s.roundCap != null && s.streak >= s.roundCap;

function seen(s: RoomState, handle: string, at: number): Agent[] {
  return s.agents.map((a) => (a.handle === handle ? { ...a, presence: "listening" as const, lastSeen: new Date(at).toISOString() } : a));
}

export function createTask(s: RoomState, at: number, by: string, title: string, assignee: string | null, text: { description?: string | null; spec?: string | null; after?: number[] } = {}) {
  const id = s.tasks.length + 1;
  const after = text.after ?? [];
  const waiting = after.filter((n) => s.tasks.find((t) => t.id === n)?.status !== "done");
  const order = after.length ? `, after ${after.map((n) => `#${n}`).join(", ")}${waiting.length ? ` (blocked by ${waiting.map((n) => `#${n}`).join(", ")})` : ""}` : "";
  const next = {
    ...s,
    tasks: [...s.tasks, { id, title, status: "open" as const, owner: null, assignee, createdBy: by, note: null, description: text.description ?? null, spec: text.spec ?? null, specFile: null, after, blocked: waiting, reopened: null }],
  };
  return { id, room: system(next, at, `${by} created task #${id} "${title}"${assignee ? ` for @${assignee}` : ""}${order}`) };
}

export function apply(s: RoomState, step: Step, at: number, sprite: () => FileMeta): RoomState {
  const streak = counts(step) ? s.streak + 1 : s.streak;
  switch (step.t) {
    case "join": {
      const agent: Agent = {
        handle: step.h,
        harness: step.harness,
        role: step.role,
        ...(step.role === "lead" && { lead: true }),
        parent: null,
        status: "active",
        presence: "listening",
        ...(s.folder && { folder: s.folder, folderCheck: "inside" as const }),
        lastSeen: new Date(at).toISOString(),
      };
      return system({ ...s, agents: [...s.agents, agent] }, at, `${step.h} joined as ${step.role}`);
    }
    case "spawn": {
      const parent = s.agents.find((a) => a.handle === step.parent);
      const child: Agent = {
        handle: step.h,
        harness: parent?.harness ?? "other",
        role: step.role,
        parent: step.parent,
        status: "active",
        presence: "working",
        ...(s.folder && { folder: s.folder, folderCheck: "inside" as const }),
        lastSeen: new Date(at).toISOString(),
      };
      return system({ ...s, agents: [...seen(s, step.parent, at), child] }, at, `${step.parent} spawned ${step.h}`);
    }
    case "you":
      return addMessage({ ...s, streak: 0 }, at, "you", step.text);
    case "post":
      return addMessage({ ...s, streak, agents: seen(s, step.h, at) }, at, step.h, step.text, {
        for: step.relay ? "you" : null,
        files: step.sprite ? [sprite()] : [],
      });
    case "task":
      return createTask({ ...s, streak, agents: seen(s, step.by, at) }, at, step.by, step.title, step.for).room;
    case "claim":
      return system(
        {
          ...s,
          agents: seen(s, step.h, at),
          tasks: s.tasks.map((t) => (t.id === step.id ? { ...t, status: "claimed", owner: step.h } : t)),
        },
        at,
        `${step.h} claimed task #${step.id}`,
      );
    case "done": {
      const task = s.tasks.find((t) => t.id === step.id);
      return system(
        {
          ...s,
          streak,
          agents: seen(s, step.h, at),
          tasks: s.tasks.map((t) => (t.id === step.id ? { ...t, status: "done", owner: step.h, note: step.note } : t)),
        },
        at,
        `${step.h} finished task #${step.id} "${task?.title ?? ""}": ${step.note}`,
      );
    }
  }
}

/** The room after the first `count` steps, spread over the minutes before `now`. */
export function roomAt(count: number, now: number, sprite: () => FileMeta) {
  return SCRIPT.slice(0, count).reduce((s, step, i) => apply(s, step, now - (count - i) * HISTORY_GAP, sprite), EMPTY);
}
