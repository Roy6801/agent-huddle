"use client";

import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CornerDownRightIcon,
  GitForkIcon,
  ListPlusIcon,
  LogInIcon,
  PauseIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { Jazzicon } from "@/components/jazzicon";
import { PixelSprite } from "@/components/pixel-sprite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HARNESS_NAME,
  INITIAL_STEPS,
  ROUND_CAP,
  SCRIPT,
  applyStep,
  harnessOf,
  speakerOf,
  stateAt,
  type Attachment,
  type DemoState,
  type FeedItem,
  type Handle,
  type Harness,
  type Member,
  type Task,
} from "@/lib/demo-script";
import { cn } from "@/lib/utils";

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

const FINAL = stateAt(SCRIPT.length);
const INITIAL = stateAt(INITIAL_STEPS);

export function HuddleDemo() {
  const reduced = useReducedMotion();
  const [state, setState] = useState<DemoState>(INITIAL);
  const [typing, setTyping] = useState<Handle | null>(null);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const control = useRef({ paused: false, offscreen: false });

  useEffect(() => {
    control.current.paused = paused;
  }, [paused]);

  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      control.current.offscreen = !entry.isIntersecting;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;

    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        let left = ms;
        let last = performance.now();
        const tick = (now: number) => {
          if (cancelled) return reject(new Error("cancelled"));
          const { paused, offscreen } = control.current;
          if (!paused && !offscreen && !document.hidden) left -= now - last;
          last = now;
          if (left <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    (async () => {
      for (;;) {
        await sleep(1400);
        for (let i = INITIAL_STEPS; i < SCRIPT.length; i++) {
          const step = SCRIPT[i];
          const speaker = speakerOf(step);
          if (speaker) {
            setTyping(speaker);
            await sleep(speaker === "you" ? 900 : 1300);
            setTyping(null);
          }
          setState((s) => applyStep(s, step, i, true));
          await sleep(step.t === "post" || step.t === "you" ? 1500 : step.t === "held" ? 2600 : 800);
        }
        await sleep(6500);
        setState(INITIAL);
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [reduced]);

  const view = reduced ? FINAL : state;
  const typingNow = reduced ? null : typing;

  return (
    <div
      ref={root}
      role="region"
      aria-label="Simulated huddle: three agents and you build a small game"
      className="relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_0_oklch(0_0_0/0.04),0_24px_64px_-24px_oklch(0_0_0/0.18)] dark:shadow-[0_24px_64px_-24px_oklch(0_0_0/0.7)]"
    >
      <p className="sr-only">
        In this demo, claude-1 asks codex-1 to draw the player sprite and agy-1 to lay out level 1, both tasks get
        claimed, claude-1 spawns claude-1.tester, a relayed note appears as claude-1 (for @you), codex-1 refuses to
        delete files without your approval, then shares player.png as an attachment, the server pauses agents after
        10 posts in a row, and your reply approves the deletion and resumes the room.
      </p>

      <div className="flex h-12 items-center gap-3 border-b bg-muted/30 pl-4 pr-1.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-xs" aria-hidden>
          <span className="font-medium">moonhop</span>
          <span className="hidden truncate font-mono text-muted-foreground sm:inline">127.0.0.1:4747</span>
        </div>
        {!reduced && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
            {paused ? "Play demo" : "Pause demo"}
          </Button>
        )}
      </div>

      <div aria-hidden className="grid grid-cols-1 lg:grid-cols-[13.5rem_minmax(0,1fr)_17rem] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <Roster members={view.members} typing={typingNow} />
        <Feed items={view.feed} typing={typingNow} />
        <Board tasks={view.tasks} streak={view.streak} held={view.held} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>A simulated huddle. Real rooms run on your machine.</span>
        <Badge variant="outline" className="hidden font-mono font-normal text-muted-foreground sm:inline-flex">
          local only
        </Badge>
      </div>
    </div>
  );
}

function Roster({ members, typing }: { members: Member[]; typing: Handle | null }) {
  return (
    <div className="min-w-0 border-b lg:border-b-0 lg:border-r">
      <p className="hidden px-4 pb-2 pt-4 text-xs font-medium text-muted-foreground lg:block">In the room</p>
      <ul className="flex gap-1.5 overflow-x-auto px-3 py-3 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-2 lg:pt-0">
        {members.map((m) => (
          <li
            key={m.h}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-opacity duration-500 lg:border-transparent lg:py-2",
              !m.present && "opacity-45",
              m.child && "lg:pl-6",
              m.child && "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
            )}
          >
            {m.child && <CornerDownRightIcon className="hidden size-3.5 text-muted-foreground lg:block" />}
            <span className="relative shrink-0">
              <Jazzicon handle={m.h} size={22} />
              <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5">
                {m.present && typing === m.h && (
                  <span className="absolute inset-0 rounded-full bg-presence opacity-60 motion-safe:animate-ping" />
                )}
                <span
                  className={cn(
                    "relative size-2.5 rounded-full ring-2 ring-card transition-colors duration-500",
                    m.present ? "bg-presence" : "bg-muted-foreground/40",
                  )}
                />
              </span>
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className={cn("font-mono text-xs font-medium", m.h === "you" && "text-signal")}>
                {m.h === "you" ? "@you" : m.h}
              </span>
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
                {m.role}
                {m.harness !== "browser" && (
                  <>
                    <HarnessDot harness={m.harness} />
                    {HARNESS_NAME[m.harness]}
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const HARNESS_DOT: Record<Exclude<Harness, "browser">, string> = {
  claude: "bg-harness-claude",
  codex: "bg-harness-codex",
  agy: "bg-harness-agy",
};

function HarnessDot({ harness }: { harness: Harness }) {
  if (harness === "browser") return null;
  return <span className={cn("size-1.5 shrink-0 rounded-full", HARNESS_DOT[harness])} />;
}

function FileChip({ file }: { file: Attachment }) {
  return (
    <span className="mt-1.5 inline-flex items-center gap-2.5 rounded-lg border bg-background/60 p-1 pr-3">
      <span className="grid size-10 place-items-center rounded-md bg-muted">
        <PixelSprite className="size-7" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-mono text-xs font-medium">{file.name}</span>
        <span className="text-[11px] text-muted-foreground">{file.size}</span>
      </span>
    </span>
  );
}

const MENTION = /@[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*(?:\.\*)?/g;

function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(
      <span
        key={index}
        className={cn(
          "rounded px-0.5 font-mono text-[0.92em] font-medium",
          match[0] === "@you" ? "bg-signal/10 text-signal" : "text-foreground",
        )}
      >
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const EVENT_ICON = {
  join: LogInIcon,
  task: ListPlusIcon,
  claim: CircleDotIcon,
  done: CircleCheckIcon,
  spawn: GitForkIcon,
};

function FeedLine({ item }: { item: FeedItem }) {
  const enter = item.fresh && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300";

  if (item.kind === "event") {
    const Icon = EVENT_ICON[item.event];
    return (
      <li className={cn("flex items-start gap-2 py-0.5 font-mono text-[11.5px] text-muted-foreground", enter)}>
        <Icon className={cn("mt-px size-3.5 shrink-0", item.event === "done" && "text-presence")} />
        <span className="min-w-0">{item.text}</span>
      </li>
    );
  }

  if (item.kind === "held") {
    return (
      <li
        className={cn(
          "flex items-start gap-2 rounded-lg border border-signal/25 bg-signal/5 px-3 py-2 font-mono text-[11.5px] text-signal",
          enter,
        )}
      >
        <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
        <span className="min-w-0">{item.text}</span>
      </li>
    );
  }

  const you = item.kind === "you";
  const handle: Handle = you ? "you" : item.h;
  return (
    <li className={cn("flex items-start gap-2.5 py-1", you && "-ml-3 border-l-2 border-signal pl-2.5", enter)}>
      <Jazzicon handle={handle} size={24} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("font-mono text-xs font-semibold", you && "text-signal")}>
            {you ? "@you" : item.h}
            {!you && item.relay && <span className="font-normal text-muted-foreground"> (for @you)</span>}
          </span>
          <HarnessDot harness={harnessOf(handle)} />
          {!you && item.relay && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
              relayed
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/85">
          <RichText text={item.text} />
        </p>
        {!you && item.file && <FileChip file={item.file} />}
      </div>
    </li>
  );
}

function Feed({ items, typing }: { items: FeedItem[]; typing: Handle | null }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Anchored to the bottom like a chat, then pinned to the newest message once it overflows.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setOverflowing(el.scrollHeight > el.clientHeight);
  }, [items, typing]);

  return (
    <div className="relative h-[23rem] min-w-0 sm:h-[26rem] md:h-[30rem] lg:h-[34rem] xl:h-[40rem]">
      {overflowing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-linear-to-b from-card to-transparent" />
      )}
      <div ref={scroller} className="h-full overflow-hidden">
      <ol className="flex min-h-full flex-col justify-end gap-2.5 px-4 pt-4 pb-4 sm:px-5">
        {items.map((item) => (
          <FeedLine key={item.key} item={item} />
        ))}
        <li className="flex h-5 items-center gap-2 text-[11.5px] text-muted-foreground">
          {typing && (
            <Fragment>
              <span className="flex gap-0.5">
                <span className="size-1 rounded-full bg-muted-foreground animate-typing-dot" />
                <span className="size-1 rounded-full bg-muted-foreground animate-typing-dot [animation-delay:150ms]" />
                <span className="size-1 rounded-full bg-muted-foreground animate-typing-dot [animation-delay:300ms]" />
              </span>
              <span className="font-mono">{typing === "you" ? "@you" : typing} is typing</span>
            </Fragment>
          )}
        </li>
      </ol>
      </div>
    </div>
  );
}

const STATUS = {
  open: { icon: CircleDashedIcon, label: "open", className: "text-muted-foreground" },
  claimed: { icon: CircleDotIcon, label: "claimed", className: "text-foreground" },
  done: { icon: CircleCheckIcon, label: "done", className: "text-presence" },
} as const;

function Board({ tasks, streak, held }: { tasks: Task[]; streak: number; held: boolean }) {
  return (
    <div className="flex flex-col gap-5 border-t p-4 lg:border-l lg:border-t-0">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Round cap</p>
          <p className={cn("font-mono text-[11px] tabular-nums", held ? "text-signal" : "text-muted-foreground")}>
            {held ? "waiting on @you" : `${streak} of ${ROUND_CAP}`}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-10 gap-1">
          {Array.from({ length: ROUND_CAP }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                i < streak ? (held ? "bg-signal" : "bg-foreground/70") : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {held ? "Agents paused after 10 posts in a row." : "Agent posts since you last spoke."}
        </p>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Tasks</p>
        {tasks.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No tasks yet
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {tasks.map((task) => {
              const status = STATUS[task.status];
              const Icon = status.icon;
              return (
                <li
                  key={`${task.id}-${task.status}`}
                  className="flex items-start gap-2.5 rounded-lg border bg-background/60 px-3 py-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                >
                  <Icon className={cn("mt-0.5 size-3.5 shrink-0", status.className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug">
                      <span className="font-mono text-muted-foreground">#{task.id}</span> {task.title}
                    </p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <Jazzicon handle={task.owner ?? task.for} size={14} />
                      <span className="truncate">
                        {task.status === "done"
                          ? `${task.owner}: ${task.note}`
                          : task.status === "claimed"
                            ? `claimed by ${task.owner}`
                            : `for @${task.for}`}
                      </span>
                    </p>
                  </div>
                  <span className={cn("font-mono text-[10.5px]", status.className)}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
