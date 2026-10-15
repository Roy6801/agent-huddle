import { useSyncExternalStore } from "react";

import type { RoomSource, RoomState } from "@/hooks/use-room";
import type { ApiError, Posted, Upload, UploadOutcome } from "@/lib/api";
import type { FileMeta, Headless } from "@/lib/types";
import { addMessage, apply, atCap, counts, createTask, INITIAL_STEPS, roomAt, SCRIPT, system, type Step } from "@/demo/script";
import { sprite } from "@/demo/sprite";

/** Pause on the finished room before it starts over. */
const LOOP_PAUSE = 6000;
const RESTART_DELAY = 1500;
/** Long enough to see the room waiting on you before the scripted reply. */
const AT_CAP_HOLD = 3500;

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const spriteMeta = () => sprite().meta;

// With reduced motion the demo opens on the finished room and only plays on request.
let next = reduced ? SCRIPT.length : INITIAL_STEPS;
let room: RoomState = roomAt(next, Date.now(), spriteMeta);
let status = { playing: false };
let timer: ReturnType<typeof setTimeout> | undefined;
const uploads = new Map<string, { meta: FileMeta; url: string }>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setRoom(r: RoomState) {
  room = r;
  listeners.forEach((l) => l());
}

function setPlaying(playing: boolean) {
  status = { playing };
  listeners.forEach((l) => l());
}

/** Longer messages take longer to write. */
function delay(step: Step | undefined) {
  if (!step) return LOOP_PAUSE;
  if (step.t === "you" && atCap(room)) return AT_CAP_HOLD;
  const text = step.t === "post" || step.t === "you" ? step.text : "";
  return Math.min(2500, 1500 + text.length * 10);
}

function schedule(ms = delay(SCRIPT[next])) {
  clearTimeout(timer);
  if (status.playing) timer = setTimeout(tick, ms);
}

function restart() {
  uploads.forEach(({ url }) => URL.revokeObjectURL(url));
  uploads.clear();
  next = INITIAL_STEPS;
  setRoom(roomAt(next, Date.now(), spriteMeta));
}

function tick() {
  const step = SCRIPT[next];
  if (!step) {
    restart();
    return schedule(RESTART_DELAY);
  }
  // At the round cap agents wait for you, as on the server; a reply from you lets them go on.
  if (!(counts(step) && atCap(room))) {
    next++;
    setRoom(apply(room, step, Date.now(), spriteMeta));
  }
  schedule();
}

export const player = {
  play() {
    if (next >= SCRIPT.length) restart();
    setPlaying(true);
    schedule();
  },
  pause() {
    clearTimeout(timer);
    setPlaying(false);
  },
  replay() {
    restart();
    setPlaying(true);
    schedule(RESTART_DELAY);
  },
  /** Autoplay, unless the reader asked for reduced motion. */
  start() {
    if (!reduced) player.play();
  },
};

export const usePlayer = () => useSyncExternalStore(subscribe, () => status);

export const useAtCap = () => useSyncExternalStore(subscribe, () => atCap(room));

const noop = () => {};

function useRoomState() {
  const state = useSyncExternalStore(subscribe, () => room);
  return { state, pollNow: noop, endHuddle: noop };
}

type Body = Partial<Headless> & { text?: string; files?: string[]; title?: string; assignee?: string; description?: string; spec?: string; roundCap?: number | null };

/** Your actions change this page's copy of the room only; nothing leaves the browser. */
async function post<T = ApiError>(path: string, body: unknown): Promise<Posted<T>> {
  const b = body as Body;
  const now = Date.now();
  let data: object = {};
  if (path === "/api/post") {
    const files = (b.files ?? []).flatMap((id) => uploads.get(id)?.meta ?? []);
    setRoom(addMessage({ ...room, streak: 0 }, now, "you", b.text ?? "", { files }));
    data = { id: room.messages.at(-1)?.id };
  } else if (path === "/api/tasks") {
    const task = createTask({ ...room, streak: 0 }, now, "you", b.title ?? "", b.assignee ?? null);
    const description = b.description ?? null;
    const spec = b.spec ?? null;
    setRoom({ ...task.room, tasks: task.room.tasks.map((t) => (t.id === task.id ? { ...t, description, spec } : t)) });
    data = { id: task.id };
  } else if (path === "/api/settings") {
    if (b.roundCap !== undefined) {
      const roundCap = b.roundCap;
      const text = roundCap === null ? "you turned the round cap off (agents won't pause for you)" : `you set the round cap to ${roundCap}`;
      setRoom(system({ ...room, roundCap, streak: 0 }, now, text));
    } else if (room.headless) {
      const h = { ...room.headless, ...b };
      setRoom(system({ ...room, headless: h, streak: 0 }, now, `you set headless budgets: ${h.wakesPerHour} wakes/h, ${h.runMinutes} min/run, stop after ${h.idleMinutes} min idle`));
    }
  } else if (path.startsWith("/api/asks/") || path.startsWith("/api/agents/")) {
    // The demo room never asks and has no headless agents; there is nothing to answer or stop.
  } else {
    return { r: new Response(null, { status: 404 }), data: { error: "not part of the demo" } as Posted<T>["data"] };
  }
  return { r: new Response(null, { status: 200 }), data: data as Posted<T>["data"] };
}

let uploadSeq = 0;

/** Pretends to upload: progress in quarters, then the file stays in the page as a blob. */
function upload(file: File, name: string, onProgress: (pct: number) => void): Upload {
  let settle: (outcome: UploadOutcome) => void = noop;
  const done = new Promise<UploadOutcome>((resolve) => (settle = resolve));
  let pct = 0;
  const ticker = setInterval(() => {
    pct += 25;
    onProgress(pct);
    if (pct < 100) return;
    clearInterval(ticker);
    const id = `demo-upload-${++uploadSeq}`;
    uploads.set(id, { meta: { id, name, size: file.size, type: file.type }, url: URL.createObjectURL(file) });
    settle({ kind: "load", status: 201, data: { id, size: file.size } });
  }, 150);
  return {
    done,
    abort: () => {
      clearInterval(ticker);
      settle({ kind: "abort" });
    },
  };
}

function fileUrl(id: string) {
  return id === sprite().meta.id ? sprite().url : (uploads.get(id)?.url ?? "");
}

export const demoSource: RoomSource = { useRoomState, post, upload, fileUrl, canCopyJoin: false, quiet: true };
