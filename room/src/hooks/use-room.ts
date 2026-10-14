import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { base } from "@/lib/api";
import type { Agent, Conn, Message, SharedFile, StateResponse, Task } from "@/lib/types";

export type RoomState = {
  name: string;
  joinUrl: string;
  agents: Agent[];
  tasks: Task[];
  messages: Message[];
  /** undefined until the first state arrives; null means no cap. */
  roundCap: number | null | undefined;
  streak: number;
  conn: Conn;
  notice: string;
  loaded: boolean;
  ended: boolean;
};

const INITIAL: RoomState = {
  name: "",
  joinUrl: "",
  agents: [],
  tasks: [],
  messages: [],
  roundCap: undefined,
  streak: 0,
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
  const sig = useRef({ agents: "", tasks: "" });

  const endHuddle = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    clearTimeout(timer.current);
    setState((s) => ({ ...s, ended: true, conn: "ended", notice: "" }));
  }, []);

  const poll = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    let delay = 1000;
    try {
      const r = await fetch(`${base}/api/state?since=${lastId.current}`, { cache: "no-store" });
      if (r.status === 410) {
        endHuddle();
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
        const agentsSig = JSON.stringify(agents);
        const tasksSig = JSON.stringify(tasks);
        const agentsChanged = agentsSig !== sig.current.agents;
        const tasksChanged = tasksSig !== sig.current.tasks;
        sig.current = { agents: agentsSig, tasks: tasksSig };
        setState((s) => {
          const name = data.room?.name ?? s.name;
          const joinUrl = data.room?.join ?? s.joinUrl;
          const roundCap = data.roundCap === null || typeof data.roundCap === "number" ? data.roundCap : s.roundCap;
          const streak = data.agentStreak ?? 0;
          const unchanged =
            s.loaded &&
            !fresh.length &&
            !agentsChanged &&
            !tasksChanged &&
            s.conn === "live" &&
            !s.notice &&
            name === s.name &&
            joinUrl === s.joinUrl &&
            roundCap === s.roundCap &&
            streak === s.streak;
          if (unchanged) return s;
          return {
            ...s,
            name,
            joinUrl,
            roundCap,
            streak,
            agents: agentsChanged ? agents : s.agents,
            tasks: tasksChanged ? tasks : s.tasks,
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

export type Identities = Map<string, { harness: string; role: string | null }>;

export type Room = ReturnType<typeof useRoomState> & {
  identities: Identities;
  live: Agent[];
  files: SharedFile[];
  atCap: boolean;
  announce: (msg: string) => void;
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
