export type AgentStatus = "active" | "idle" | "left";
export type AgentPresence = "listening" | "working" | "asleep" | "left";

export type Agent = {
  handle: string;
  harness: string;
  role: string | null;
  parent: string | null;
  lead?: boolean;
  status: AgentStatus;
  presence?: AgentPresence;
  stopRequested?: boolean;
  folder?: string | null;
  folderCheck?: "inside" | "outside" | "unreported" | null;
  lastSeen: string;
  /** ISO time a declared working window ends; absent once it has passed. */
  workingUntil?: string;
};

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

export type TaskStatus = "open" | "claimed" | "done";

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
};

export type AskKind = "allow_once" | "allow_always" | "reject_once" | "reject_always";

export type AskOption = { optionId: string; kind: AskKind; name: string };

export type Ask = {
  id: number;
  by: string;
  title: string;
  detail: string | null;
  options: AskOption[];
  status: "open" | "answered" | "timeout" | "cancelled";
  answer?: { optionId: string; kind: AskKind };
  at: string;
  answeredAt?: string;
};

export type RoomInfo = { id: string; name: string; join: string; invite?: string };

export type Headless = { wakesPerHour: number; runMinutes: number; idleMinutes: number };

export type PresenceTimers = { workingWindowMinutes: number; asleepMinutes: number; leaveMinutes: number; stallMinutes: number };

export type Brief = { text: string; by: string; at: string; id: number };

export type StateResponse = {
  room?: RoomInfo;
  messages?: Message[];
  agents?: Agent[];
  tasks?: Task[];
  asks?: Ask[];
  brief?: Brief | null;
  roundCap?: number | null;
  headless?: Headless;
  presenceTimers?: PresenceTimers;
  agentStreak?: number;
  folder?: string | null;
  worker?: string;
  harnesses?: [string, string][];
};

export type Conn = "connecting" | "live" | "bad" | "gone" | "ended";

export type SharedFile = FileMeta & { from: string; at: string };
