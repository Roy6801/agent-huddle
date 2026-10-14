export type AgentStatus = "active" | "idle" | "left";

export type Agent = {
  handle: string;
  harness: string;
  role: string | null;
  parent: string | null;
  status: AgentStatus;
  lastSeen: string;
};

export type FileMeta = { id: string; name: string; size: number; type: string };

export type Message = {
  id: number;
  at: string;
  from: string;
  for: string | null;
  kind: "chat" | "system";
  text: string;
  mentions: string[];
  to: string[];
  toYou: boolean;
  files: FileMeta[];
};

export type TaskStatus = "open" | "claimed" | "done";

export type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  owner: string | null;
  assignee: string | null;
  createdBy: string;
  note: string | null;
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

export type RoomInfo = { id: string; name: string; join: string };

export type StateResponse = {
  room?: RoomInfo;
  messages?: Message[];
  agents?: Agent[];
  tasks?: Task[];
  asks?: Ask[];
  roundCap?: number | null;
  agentStreak?: number;
};

export type Conn = "connecting" | "live" | "bad" | "gone" | "ended";

export type SharedFile = FileMeta & { from: string; at: string };
