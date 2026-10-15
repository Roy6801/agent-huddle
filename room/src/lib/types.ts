export type AgentStatus = "active" | "idle" | "left";
/** waiting: blocked on its own app's approval prompt, which only you can answer there. */
export type AgentPresence = "listening" | "working" | "waiting" | "asleep" | "left";

export type Agent = {
  handle: string;
  harness: string;
  role: string | null;
  parent: string | null;
  lead?: boolean;
  /** Runs through a headless worker; it can also hold any role. */
  headless?: boolean;
  status: AgentStatus;
  presence?: AgentPresence;
  stopRequested?: boolean;
  folder?: string | null;
  folderCheck?: "inside" | "outside" | "unreported" | null;
  /** Its own git worktree of the room folder's repository, when the room gives each agent one. */
  worktree?: Worktree;
  lastSeen: string;
  /** ISO time a declared working window ends; absent once it has passed. */
  workingUntil?: string;
  /** Tasks it holds while Asleep; the steward releases them after the release timer. */
  asleepHolding?: number[];
};

export type Worktree = { path: string; branch: string; base: string };

export type FileMeta = { id: string; name: string; size: number; type: string };

export type Message = {
  id: number;
  at: string;
  from: string;
  for: string | null;
  kind: "chat" | "system" | "log";
  text: string;
  mentions: string[];
  to: string[];
  toYou: boolean;
  files: FileMeta[];
  /** Set on system notes about an ask; the page shows the ask card instead. */
  ask?: number;
  /** Set on system notes about a task. */
  task?: number;
  /** Set on the system post that announces the pinned brief. */
  brief?: boolean;
};

export type TaskStatus = "open" | "claimed" | "done" | "cancelled";

export type TaskSpecFile = { id: string; name: string; size: number };

export type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  owner: string | null;
  assignee: string | null;
  createdBy: string;
  note: string | null;
  description: string | null;
  spec: string | null;
  specFile: TaskSpecFile | null;
  /** Prerequisite task ids, sorted. */
  after: number[];
  /** The prerequisites that are not done yet. */
  blocked: number[];
  reopened: { by: string; reason: string; at: string } | null;
  /** Absent in history written before tasks could be cancelled. */
  cancelled?: { by: string; reason: string | null; at: string } | null;
};

export type AskKind = "allow_once" | "allow_always" | "reject_once" | "reject_always";

export type AskOption = { optionId: string; kind: AskKind; name: string };

export type Ask = {
  id: number;
  by: string;
  /** in-terminal: the agent is waiting for your approval in its own app; it has no options, only Done. */
  kind?: "in-terminal";
  title: string;
  detail: string | null;
  /** Where the in-terminal prompt is; null means the agent's own terminal. */
  where?: string | null;
  options: AskOption[];
  status: "open" | "answered" | "timeout" | "cancelled" | "done";
  /** Who cleared an in-terminal notice: you (Done) or the agent (its next call). */
  doneBy?: string;
  answer?: { optionId: string; kind: AskKind };
  at: string;
  answeredAt?: string;
};

export type RoomInfo = { id: string; name: string; join: string; invite?: string };

export type Headless = { wakesPerHour: number; runMinutes: number; idleMinutes: number };

/** regular: a free agent may take a ready task assigned to someone else; strict: only the assignee may claim it. */
export type Assignment = "regular" | "strict";
export type WorktreeMode = "off" | "per-agent";

/** A headless worker this room's page started; the server runs it and writes its output to `log`. */
export type StartedWorker = {
  id: number;
  harness: string;
  label: string;
  folder: string;
  log: string;
  status: "starting" | "running" | "stopping" | "stopped" | "failed";
  handle: string | null;
  error: string | null;
  startedAt: string;
};

export type PresenceTimers = { workingWindowMinutes: number; asleepMinutes: number; leaveMinutes: number; stallMinutes: number; releaseMinutes: number };

export type Brief = { text: string; by: string; at: string; id: number };

export type StateResponse = {
  room?: RoomInfo;
  /** Path of the home page; only given to a page opened with a valid key. */
  home?: string;
  messages?: Message[];
  agents?: Agent[];
  tasks?: Task[];
  asks?: Ask[];
  brief?: Brief | null;
  roundCap?: number | null;
  assignment?: Assignment;
  worktrees?: WorktreeMode;
  headless?: Headless;
  presenceTimers?: PresenceTimers;
  agentStreak?: number;
  folder?: string | null;
  worker?: string;
  harnesses?: [string, string][];
  workers?: StartedWorker[];
};

/** When and why the room ended, and where its transcript is; null when the history does not say. */
export type EndedInfo = { at: string | null; reason: string | null; transcript: string | null };

/** An ended room read from its history. Only `ended` comes back for history too old to check the page link against. */
export type HistoryResponse = {
  ended: EndedInfo;
  home?: string;
  room?: { name: string; createdAt: string; folder: string | null };
  messages?: Message[];
  agents?: Agent[];
  tasks?: Task[];
  asks?: Ask[];
  brief?: Brief | null;
};

export type Conn = "connecting" | "live" | "bad" | "gone" | "ended";

export type SharedFile = FileMeta & { from: string; at: string };

type HomeRoom = { id: string; name: string; createdAt: string; page: string };

/** The home page's list: live rooms link to their page, past rooms open read-only from history. */
export type HomeResponse = {
  live: (HomeRoom & { agents: { active: number; total: number } })[];
  past: (HomeRoom & { ended: { at: string; reason: string | null } | null; transcript: string })[];
};
