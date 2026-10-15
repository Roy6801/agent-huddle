import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { base, type ApiError, type Posted, type Upload } from "@/lib/api";
import type { Agent, Ask, Assignment, Brief, Conn, EndedInfo, Headless, HistoryResponse, Message, PresenceTimers, SharedFile, StartedWorker, StateResponse, Task } from "@/lib/types";

export type RoomState = {
  name: string;
  joinUrl: string;
  /** Self-contained invite for agents without the skill. */
  invite?: string;
  /** Where the room was created; suggested for headless agents. */
  folder?: string | null;
  /** Absolute path of the server's huddle.mjs, for the headless command. */
  worker?: string;
  /** Headless harnesses the server supports, as [id, label]. */
  harnesses?: [string, string][];
  /** Headless workers started from this page. */
  workers: StartedWorker[];
  agents: Agent[];
  tasks: Task[];
  asks: Ask[];
  messages: Message[];
  /** The pinned room brief; null when none is set. */
  brief: Brief | null;
  /** undefined until the first state arrives; null means no cap. */
  roundCap: number | null | undefined;
  streak: number;
  /** undefined until the first state arrives. */
  assignment: Assignment | undefined;
  /** undefined until the first state arrives. */
  headless: Headless | undefined;
  /** undefined until the first state arrives. */
  presenceTimers: PresenceTimers | undefined;
  conn: Conn;
  notice: string;
  loaded: boolean;
  ended: boolean;
  /** When and why the room ended and where its transcript is, for the ended banner. */
  endedInfo?: EndedInfo;
};

const INITIAL: RoomState = {
  name: "",
  joinUrl: "",
  workers: [],
  agents: [],
  tasks: [],
  asks: [],
  messages: [],
  brief: null,
  roundCap: undefined,
  streak: 0,
  assignment: undefined,
  headless: undefined,
  presenceTimers: undefined,
  conn: "connecting",
  notice: "",
  loaded: false,
  ended: false,
};

const GONE =
  "This link is wrong or the room is gone (the server may have restarted). Run the new command to get a fresh link.";

/** Polls GET api/state every second (5s after a failure) and keeps the room's state. */
export function useRoomState() {
  const [state, setState] = useState<RoomState>(INITIAL);
  const lastId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const polling = useRef(false);
  const ended = useRef(false);
  const sig = useRef({ agents: "", tasks: "", asks: "" });

  // Once ended, the room is shown read-only from its history: everything it said, its final board and brief.
  const endHuddle = useCallback((transcript?: string) => {
    if (ended.current) return;
    ended.current = true;
    clearTimeout(timer.current);
    const endedInfo = { at: null, reason: null, transcript: transcript ?? null };
    setState((s) => ({ ...s, ended: true, endedInfo, conn: "ended", notice: "" }));
    fetch(`${base}/api/history`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<HistoryResponse>) : null))
      .then((h) => {
        if (!h) return;
        setState((s) => ({
          ...s,
          endedInfo: h.ended,
          loaded: true,
          ...(h.room && {
            name: h.room.name,
            folder: h.room.folder,
            messages: h.messages ?? [],
            tasks: h.tasks ?? [],
            agents: (h.agents ?? []).map((a) => ({ ...a, presence: "left" as const })),
            asks: h.asks ?? [],
            brief: h.brief ?? null,
          }),
        }));
      })
      .catch(() => {});
  }, []);

  const poll = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    let delay = 1000;
    try {
      const r = await fetch(`${base}/api/state?since=${lastId.current}`, { cache: "no-store" });
      if (r.status === 410) {
        const body: (ApiError & { transcript?: string }) | null = await r.json().catch(() => null);
        endHuddle(body?.transcript);
      } else if (r.status === 401 || r.status === 404) {
        setState((s) => ({ ...s, notice: GONE, conn: "gone" }));
        delay = 5000;
      } else if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      } else {
        const data: StateResponse = await r.json();
        const fresh = (data.messages ?? []).filter((m) => m.id > lastId.current);
        for (const m of fresh) lastId.current = Math.max(lastId.current, m.id);
        const agents = data.agents ?? [];
        const tasks = data.tasks ?? [];
        const asks = data.asks ?? [];
        const agentsSig = JSON.stringify(agents);
        const tasksSig = JSON.stringify(tasks);
        const asksSig = JSON.stringify(asks);
        const agentsChanged = agentsSig !== sig.current.agents;
        const tasksChanged = tasksSig !== sig.current.tasks;
        const asksChanged = asksSig !== sig.current.asks;
        sig.current = { agents: agentsSig, tasks: tasksSig, asks: asksSig };
        setState((s) => {
          const name = data.room?.name ?? s.name;
          const joinUrl = data.room?.join ?? s.joinUrl;
          const invite = data.room?.invite ?? s.invite;
          const roundCap = data.roundCap === null || typeof data.roundCap === "number" ? data.roundCap : s.roundCap;
          const brief = "brief" in data ? (data.brief ?? null) : s.brief;
          const briefSame = brief?.id === s.brief?.id;
          const folder = data.folder ?? s.folder;
          const worker = data.worker ?? s.worker;
          const harnesses = data.harnesses ?? s.harnesses;
          const harnessesSame = JSON.stringify(harnesses) === JSON.stringify(s.harnesses);
          const workers = data.workers ?? s.workers;
          const workersSame = JSON.stringify(workers) === JSON.stringify(s.workers);
          const streak = data.agentStreak ?? 0;
          const assignment = data.assignment ?? s.assignment;
          const headless = data.headless ?? s.headless;
          const headlessSame = JSON.stringify(headless) === JSON.stringify(s.headless);
          const presenceTimers = data.presenceTimers ?? s.presenceTimers;
          const presenceTimersSame = JSON.stringify(presenceTimers) === JSON.stringify(s.presenceTimers);
          const unchanged =
            s.loaded &&
            !fresh.length &&
            !agentsChanged &&
            !tasksChanged &&
            !asksChanged &&
            s.conn === "live" &&
            !s.notice &&
            name === s.name &&
            joinUrl === s.joinUrl &&
            invite === s.invite &&
            briefSame &&
            roundCap === s.roundCap &&
            folder === s.folder &&
            worker === s.worker &&
            harnessesSame &&
            workersSame &&
            streak === s.streak &&
            assignment === s.assignment &&
            headlessSame &&
            presenceTimersSame;
          if (unchanged) return s;
          return {
            ...s,
            name,
            joinUrl,
            invite,
            roundCap,
            brief: briefSame ? s.brief : brief,
            folder,
            worker,
            harnesses: harnessesSame ? s.harnesses : harnesses,
            workers: workersSame ? s.workers : workers,
            streak,
            assignment,
            headless: headlessSame ? s.headless : headless,
            presenceTimers: presenceTimersSame ? s.presenceTimers : presenceTimers,
            agents: agentsChanged ? agents : s.agents,
            tasks: tasksChanged ? tasks : s.tasks,
            asks: asksChanged ? asks : s.asks,
            messages: fresh.length ? [...s.messages, ...fresh] : s.messages,
            conn: "live",
            notice: "",
            loaded: true,
          };
        });
      }
    } catch {
      delay = 5000;
      setState((s) => (s.conn === "bad" ? s : { ...s, conn: "bad" }));
    } finally {
      polling.current = false;
      if (!ended.current) timer.current = setTimeout(poll, delay);
    }
  }, [endHuddle]);

  const pollNow = useCallback(() => {
    if (ended.current) return;
    clearTimeout(timer.current);
    poll();
  }, [poll]);

  useEffect(() => {
    poll();
    return () => clearTimeout(timer.current);
  }, [poll]);

  return { state, pollNow, endHuddle };
}

/**
 * Where the room's state comes from and where your actions go: the local server for page.html, a
 * scripted conversation for the site's demo. Must be stable for the page's lifetime.
 */
export type RoomSource = {
  useRoomState: () => ReturnType<typeof useRoomState>;
  post: <T = ApiError>(path: string, body: unknown) => Promise<Posted<T>>;
  upload: (file: File, name: string, onProgress: (pct: number) => void) => Upload;
  fileUrl: (id: string) => string;
  /** False when the join link is only for show, as in the demo. */
  canCopyJoin: boolean;
  /** Keeps room activity out of the live regions; an autoplaying demo must not talk over the page. */
  quiet: boolean;
};

export const SourceContext = createContext<RoomSource | null>(null);

export function useSource() {
  const source = useContext(SourceContext);
  if (!source) throw new Error("useSource must be used inside SourceContext");
  return source;
}

export type Identities = Map<string, { harness: string; role: string | null }>;

export type Room = ReturnType<typeof useRoomState> & {
  identities: Identities;
  live: Agent[];
  files: SharedFile[];
  atCap: boolean;
  /** Speaks through the page's live regions; urgent is for errors and the room ending. */
  announce: (msg: string, urgent?: boolean) => void;
};

export const RoomContext = createContext<Room | null>(null);

export function useRoom() {
  const room = useContext(RoomContext);
  if (!room) throw new Error("useRoom must be used inside RoomContext");
  return room;
}

/** Derived views shared by the feed, the sidebars and the composer. */
export function useDerived(state: RoomState) {
  // lastSeen moves on every poll; the feed only needs who is who, so it gets a steadier map.
  const identitySig = JSON.stringify(state.agents.map((a) => [a.handle, a.harness, a.role]));
  const identities = useMemo(
    () => new Map((JSON.parse(identitySig) as [string, string, string | null][]).map(([h, harness, role]) => [h, { harness, role }])),
    [identitySig],
  );
  const live = useMemo(() => state.agents.filter((a) => a.status !== "left"), [state.agents]);
  const files = useMemo(() => {
    const seen = new Map<string, SharedFile>();
    for (const m of state.messages) {
      if (m.kind === "system" || m.from === "system") continue;
      for (const f of m.files ?? []) if (!seen.has(f.id)) seen.set(f.id, { ...f, from: m.from, at: m.at });
    }
    return [...seen.values()].reverse();
  }, [state.messages]);
  const atCap = state.roundCap != null && state.streak >= state.roundCap;
  return { identities, live, files, atCap };
}
