import { useCallback, useEffect, useRef, useState } from "react";

import type { RoomState } from "@/hooks/use-room";
import type { Message } from "@/lib/types";

const forYou = (m: Message) =>
  m.kind !== "system" && m.from !== "system" && m.from !== "you" && (m.toYou || m.for === "you");

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function describe(fresh: Message[]) {
  const m = fresh[fresh.length - 1];
  const body = m.text ? clip(m.text) : `${m.files.length} ${m.files.length === 1 ? "file" : "files"}`;
  const lead = fresh.length === 1 ? `${m.from} to you` : `${fresh.length} messages for you. Latest from ${m.from}`;
  return `${lead}: ${body}`;
}

/**
 * What a screen reader hears without watching the feed: messages addressed to you, new approvals, the round cap
 * pausing agents, the connection dropping or coming back, and the room ending. History that is
 * already there on load is never announced. Also keeps the tab title, with an unread count for
 * messages and approvals for you that arrive while the tab is hidden. Quiet skips messages, approvals and the cap.
 */
export function useAnnouncements(state: RoomState, atCap: boolean, quiet = false) {
  const [live, setLive] = useState({ polite: "", assertive: "" });
  const [unread, setUnread] = useState(0);
  const lastId = useRef<number | null>(null);
  const lastAsk = useRef<number | null>(null);
  const wasAtCap = useRef<boolean | null>(null);
  const prevConn = useRef(state.conn);

  /** Clearing first makes a repeated message count as a change. Urgent is for errors and the end. */
  const announce = useCallback((msg: string, urgent = false) => {
    const key = urgent ? "assertive" : "polite";
    setLive((s) => ({ ...s, [key]: "" }));
    requestAnimationFrame(() => setLive((s) => ({ ...s, [key]: msg })));
  }, []);

  useEffect(() => {
    if (!state.loaded || quiet) return;
    const last = state.messages.length ? state.messages[state.messages.length - 1].id : 0;
    const since = lastId.current;
    lastId.current = last;
    if (since === null) return;
    const fresh = state.messages.filter((m) => m.id > since && forYou(m));
    if (!fresh.length) return;
    announce(describe(fresh));
    if (document.hidden) setUnread((n) => n + fresh.length);
  }, [state.loaded, state.messages, announce, quiet]);

  useEffect(() => {
    if (!state.loaded || quiet) return;
    const last = state.asks.length ? state.asks[state.asks.length - 1].id : 0;
    const since = lastAsk.current;
    lastAsk.current = last;
    if (since === null) return;
    const fresh = state.asks.filter((a) => a.id > since && a.status === "open");
    if (!fresh.length) return;
    const a = fresh[fresh.length - 1];
    announce(fresh.length === 1 ? `${a.by} asks to ${clip(a.title)}` : `${fresh.length} approvals waiting on you. Latest: ${a.by} asks to ${clip(a.title)}`);
    if (document.hidden) setUnread((n) => n + fresh.length);
  }, [state.loaded, state.asks, announce, quiet]);

  useEffect(() => {
    if (!state.loaded || quiet) return;
    const was = wasAtCap.current;
    wasAtCap.current = atCap;
    if (was === false && atCap) announce("Agents are waiting on you. Reply to let them continue.");
  }, [state.loaded, atCap, announce, quiet]);

  useEffect(() => {
    const prev = prevConn.current;
    prevConn.current = state.conn;
    if (prev === state.conn) return;
    if (state.conn === "bad") announce("Connection lost. Retrying.", true);
    else if (state.conn === "live" && (prev === "bad" || prev === "gone")) announce("Reconnected.");
  }, [state.conn, announce]);

  useEffect(() => {
    if (state.ended) announce("This room has ended.", true);
  }, [state.ended, announce]);

  useEffect(() => {
    const reset = () => {
      if (!document.hidden) setUnread(0);
    };
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("focus", reset);
    return () => {
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("focus", reset);
    };
  }, []);

  useEffect(() => {
    const title = state.name ? `${state.name} · agent-huddle` : "agent-huddle";
    document.title = unread ? `(${unread}) ${title}` : title;
  }, [state.name, unread]);

  return { live, announce };
}
