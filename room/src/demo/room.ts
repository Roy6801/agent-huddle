import { useSyncExternalStore } from "react";

import type { RoomSource, RoomState } from "@/hooks/use-room";
import type { ApiError, Posted, Upload, UploadOutcome } from "@/lib/api";
import type { FileMeta, Headless, PresenceTimers } from "@/lib/types";
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
let room: RoomState = withBlocked(roomAt(next, Date.now(), spriteMeta));
let status = { playing: false };
let timer: ReturnType<typeof setTimeout> | undefined;
const uploads = new Map<string, { meta: FileMeta; url: string }>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fills each task's `after` and `blocked` the way the server reports them. */
function withBlocked(r: RoomState): RoomState {
  const doneIds = new Set(r.tasks.filter((t) => t.status === "done" || t.status === "cancelled").map((t) => t.id));
  return { ...r, tasks: r.tasks.map((t) => ({ ...t, blocked: t.after.filter((n) => !doneIds.has(n)) })) };
}

function setRoom(r: RoomState) {
  room = withBlocked(r);
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

type Body = Partial<Headless> & Partial<PresenceTimers> & { text?: string; files?: string[]; title?: string; assignee?: string; after?: number[]; description?: string | null; spec?: string | null; roundCap?: number | null; folder?: string };

const LIMITS = { description: 2000, spec: 20000, brief: 20000 } as const;

function overLimit(b: Body) {
  for (const field of ["description", "spec"] as const) {
    const text = b[field]?.trim();
    if (text && text.length > LIMITS[field]) return `${field} must be 1-${LIMITS[field]} characters`;
  }
  return null;
}

function rejected<T>(error: string, message: string): Posted<T> {
  return { r: new Response(null, { status: 400 }), data: { error, message } as Posted<T>["data"] };
}

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
    const tooLong = overLimit(b);
    if (tooLong) return rejected("invalid_text", tooLong);
    const after = [...new Set(b.after ?? [])].sort((x, y) => x - y);
    const missing = after.find((n) => !room.tasks.some((t) => t.id === n));
    if (missing !== undefined) return rejected("invalid_after", `There is no task #${missing}; a task can only come after tasks that already exist.`);
    const task = createTask({ ...room, streak: 0 }, now, "you", b.title ?? "", b.assignee ?? null, { ...b, after });
    setRoom(task.room);
    data = { id: task.id };
  } else if (/^\/api\/tasks\/\d+\/reopen$/.test(path)) {
    const id = Number(path.split("/")[3]);
    const old = room.tasks.find((t) => t.id === id);
    const reason = (body as { reason?: string }).reason?.trim();
    if (!reason) return rejected("invalid_text", "reason is missing, blank or longer than 8000 characters.");
    if (!old || (old.status !== "done" && old.status !== "cancelled")) return { r: new Response(null, { status: 409 }), data: { error: "not_done", message: `Task #${id} is not done or cancelled.` } as Posted<T>["data"] };
    const back = old.status === "done" ? { status: "claimed" as const, owner: old.owner } : { status: "open" as const, owner: null };
    const task = { ...old, ...back, cancelled: null, reopened: { by: "you", reason, at: new Date(now).toISOString() } };
    setRoom(system({ ...room, streak: 0, tasks: room.tasks.map((t) => (t.id === id ? task : t)) }, now, `you reopened task #${id} "${old.title}": ${reason}`));
    data = task;
  } else if (/^\/api\/tasks\/\d+\/cancel$/.test(path)) {
    const id = Number(path.split("/")[3]);
    const old = room.tasks.find((t) => t.id === id);
    if (!old || old.status === "done" || old.status === "cancelled") return { r: new Response(null, { status: 409 }), data: { error: "task_done", message: `Task #${id} is already finished.` } as Posted<T>["data"] };
    const reason = (body as { reason?: string }).reason?.trim() || null;
    const task = { ...old, status: "cancelled" as const, owner: null, cancelled: { by: "you", reason, at: new Date(now).toISOString() } };
    const tasks = room.tasks.map((t) => (t.id === id ? task : { ...t, blocked: t.blocked.filter((b) => b !== id) }));
    setRoom(system({ ...room, streak: 0, tasks }, now, `you cancelled task #${id} "${old.title}"${reason ? `: ${reason}` : ""}`));
    data = task;
  } else if (/^\/api\/tasks\/\d+\/(done|release|assign)$/.test(path)) {
    const [, , , n, action] = path.split("/");
    const id = Number(n);
    const old = room.tasks.find((t) => t.id === id);
    if (!old || old.status === "done" || old.status === "cancelled") return { r: new Response(null, { status: 409 }), data: { error: "task_done", message: `Task #${id} is already ${old?.status ?? "done"}.` } as Posted<T>["data"] };
    const note = (body as { note?: string }).note?.trim() || null;
    const assignee = (body as { assignee?: string | null }).assignee ?? null;
    const [task, text] =
      action === "done"
        ? [{ ...old, status: "done" as const, owner: "you", note }, `you marked task #${id} "${old.title}" done${note ? `: ${note}` : ""}`]
        : action === "release"
          ? [{ ...old, status: "open" as const, owner: null }, `you released task #${id} "${old.title}" from @${old.owner}`]
          : [{ ...old, status: old.owner && old.owner !== assignee ? ("open" as const) : old.status, owner: old.owner === assignee ? old.owner : null, assignee }, `you reassigned task #${id} "${old.title}" to ${assignee ? `@${assignee}` : "nobody"}`];
    const tasks = room.tasks.map((t) => (t.id === id ? task : action === "done" ? { ...t, blocked: t.blocked.filter((b) => b !== id) } : t));
    setRoom(system({ ...room, streak: 0, tasks }, now, text));
    data = task;
  } else if (path.startsWith("/api/tasks/")) {
    const id = Number(path.slice("/api/tasks/".length));
    const old = room.tasks.find((t) => t.id === id);
    const tooLong = overLimit(b);
    if (tooLong) return rejected("invalid_text", tooLong);
    if (old) {
      const task = {
        ...old,
        description: b.description === undefined ? old.description : b.description,
        spec: b.spec === undefined ? old.spec : b.spec,
        specFile: b.spec ? null : old.specFile,
      };
      setRoom(system({ ...room, streak: 0, tasks: room.tasks.map((t) => (t.id === id ? task : t)) }, now, `you edited task #${id} "${old.title}"`));
      data = task;
    }
  } else if (path === "/api/brief") {
    const text = b.text ?? "";
    if (!text.trim() || text.length > LIMITS.brief) return rejected("invalid_text", `text must be 1-${LIMITS.brief} characters`);
    const at = new Date(now).toISOString();
    const set = addMessage({ ...room, streak: 0 }, now, "system", text, { kind: "system", mentions: [], brief: true });
    const brief = { text, by: "you", at, id: set.messages.at(-1)?.id ?? 0 };
    setRoom({ ...set, brief });
    data = brief;
  } else if (path === "/api/settings") {
    if (b.folder !== undefined || b.roundCap !== undefined) {
      let next = room;
      if (b.folder !== undefined) {
        const folder = b.folder;
        if (typeof folder !== "string" || !folder.startsWith("/")) return rejected("invalid_folder", "folder must be an absolute path.");
        const old = room.folder;
        if (folder !== old) {
          const inside = (dir?: string | null) => (dir ? (dir === folder || dir.startsWith(`${folder}/`) ? ("inside" as const) : ("outside" as const)) : ("unreported" as const));
          const agents = room.agents.map((a) => ({ ...a, folderCheck: inside(a.folder) }));
          next = system({ ...room, folder, agents, streak: 0 }, now, old ? `you moved the room folder from ${old} to ${folder}` : `you set the room folder to ${folder}`);
          if (old) {
            const lead = agents.find((a) => a.lead && a.status !== "left");
            next = createTask(next, now, "you", "Move the room's content to the new folder", lead?.handle ?? null, {
              description: `From: ${old}\nTo: ${folder}\nMove the files the room made, then post where they are.`,
            }).room;
          }
        }
      }
      if (b.roundCap !== undefined) {
        const roundCap = b.roundCap;
        const text = roundCap === null ? "you turned the round cap off (agents won't pause for you)" : `you set the round cap to ${roundCap}`;
        next = system({ ...next, roundCap, streak: 0 }, now, text);
      }
      setRoom(next);
    } else if (room.presenceTimers && (b.workingWindowMinutes !== undefined || b.asleepMinutes !== undefined || b.leaveMinutes !== undefined || b.stallMinutes !== undefined)) {
      const p = { ...room.presenceTimers, ...b };
      if (p.leaveMinutes <= p.asleepMinutes) return rejected("leave_before_asleep", "leaveMinutes must be longer than asleepMinutes.");
      setRoom(system({ ...room, presenceTimers: p, streak: 0 }, now, `you set presence timers: working ${p.workingWindowMinutes} min, asleep ${p.asleepMinutes} min, leave after ${p.leaveMinutes} min, stall nudge after ${p.stallMinutes} min`));
    } else if (room.headless) {
      const h = { ...room.headless, ...b };
      setRoom(system({ ...room, headless: h, streak: 0 }, now, `you set headless budgets: ${h.wakesPerHour} wakes/h, ${h.runMinutes} min/run, stop after ${h.idleMinutes} min idle`));
    }
  } else if (path.startsWith("/api/asks/") || path.startsWith("/api/agents/")) {
    // The demo room never asks and has no headless agents; there is nothing to answer or stop.
  } else {
    return { r: new Response(null, { status: 404 }), data: { error: "not_found", message: "Not part of the demo." } as Posted<T>["data"] };
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
