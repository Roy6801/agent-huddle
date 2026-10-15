import {
  ArrowDownIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CornerDownRightIcon,
  GitForkIcon,
  InfoIcon,
  ListPlusIcon,
  LogInIcon,
  LogOutIcon,
  PinIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { memo, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";

import { AskCard } from "@/components/ask-card";
import { MessageFiles } from "@/components/files";
import { HarnessDot, Jazzicon } from "@/components/identity";
import { Invite } from "@/components/invite";
import { RichText } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Identities } from "@/hooks/use-room";
import { dayLabel, fmtTime, fullTime, harnessFromHandle, shortTime } from "@/lib/format";
import type { Ask, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYS_TYPES: [RegExp, SysType][] = [
  [/^(\S+) rejoined\b/, "join"],
  [/^(\S+) joined\b/, "join"],
  [/^(\S+) left\b/, "leave"],
  [/^(\S+) created task #/, "task"],
  [/^(\S+) claimed task #/, "claim"],
  [/^(\S+) finished task #/, "done"],
  [/^Task #\d+ .* is done by /, "done"],
  [/^(\S+) released task #/, "release"],
  [/^(\S+) spawned /, "spawn"],
  [/^(\S+) isn't listening\b/, "alert"],
  [/^Not listening:/, "alert"],
];

type SysType = "join" | "leave" | "task" | "claim" | "done" | "release" | "spawn" | "alert" | "info";

const SYS_ICON: Record<SysType, typeof InfoIcon> = {
  join: LogInIcon,
  leave: LogOutIcon,
  task: ListPlusIcon,
  claim: CircleDotIcon,
  done: CircleCheckIcon,
  release: RotateCcwIcon,
  spawn: GitForkIcon,
  alert: TriangleAlertIcon,
  info: InfoIcon,
};

const SYS_ICON_CLASS: Partial<Record<SysType, string>> = {
  join: "text-presence",
  done: "text-presence",
  claim: "text-foreground/70",
  alert: "text-idle",
};

type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "ask"; key: string; ask: Ask }
  | { kind: "sys"; key: string; m: Message }
  | { kind: "chat"; key: string; m: Message; cont: boolean };

type Entry = { m: Message; ask?: undefined } | { ask: Ask; m?: undefined };

/** Asks sit among the messages at the time they were made. */
function merge(messages: Message[], asks: Ask[]): Entry[] {
  const pending = [...asks].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const out: Entry[] = [];
  let i = 0;
  for (const m of messages) {
    while (i < pending.length && +new Date(pending[i].at) <= +new Date(m.at)) out.push({ ask: pending[i++] });
    out.push({ m });
  }
  while (i < pending.length) out.push({ ask: pending[i++] });
  return out;
}

function buildRows(messages: Message[], asks: Ask[]): Row[] {
  const rows: Row[] = [];
  let lastKey: string | null = null;
  let lastAt = 0;
  let lastDay = "";
  const askIds = new Set(asks.map((a) => a.id));
  const shown = messages.filter((m) => !(m.ask && askIds.has(m.ask)));
  for (const e of merge(shown, asks)) {
    const { m, ask } = e;
    const at = new Date(m ? m.at : ask.at);
    const ts = +at;
    if (!isNaN(ts)) {
      const day = at.toDateString();
      if (day !== lastDay) {
        rows.push({ kind: "day", key: m ? `day-${m.id}` : `day-ask-${ask.id}`, label: dayLabel(at) });
        lastDay = day;
        lastKey = null;
      }
    }
    if (ask) {
      rows.push({ kind: "ask", key: `ask-${ask.id}`, ask });
      lastKey = null;
    } else if (m.kind === "system" || m.from === "system") {
      rows.push({ kind: "sys", key: String(m.id), m });
      lastKey = null;
    } else {
      const key = m.from + (m.for === "you" && m.from !== "you" ? "|relay" : "");
      const cont = key === lastKey && ts >= lastAt && ts - lastAt <= 180000;
      rows.push({ kind: "chat", key: String(m.id), m, cont });
      lastKey = key;
      lastAt = ts;
    }
  }
  return rows;
}

function Time({ at, className }: { at: string; className?: string }) {
  const full = fullTime(at);
  return (
    <time dateTime={at} title={full} className={cn("text-[11px] text-muted-foreground tabular-nums", className)}>
      <span aria-hidden={!!full}>{fmtTime(at)}</span>
      {full && <span className="sr-only">{full}</span>}
    </time>
  );
}

const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300";

function SystemLine({ m, fresh }: { m: Message; fresh: boolean }) {
  const text = m.text || "";
  let type: SysType = "info";
  let who: string | null = null;
  for (const [re, t] of m.brief ? [] : SYS_TYPES) {
    const hit = re.exec(text);
    if (hit) {
      type = t;
      who = hit[1] ?? null;
      break;
    }
  }
  const Icon = m.brief ? PinIcon : SYS_ICON[type];
  return (
    <div
      className={cn(
        "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-3 py-0.5 text-xs leading-5 text-muted-foreground",
        (type === "alert" || (m.kind === "system" && m.toYou)) && "-mx-2 my-1 rounded-md bg-idle/10 px-2 py-1 text-foreground/80",
        fresh && ENTER,
      )}
    >
      <span className="flex justify-center pt-[3px]">
        <Icon aria-hidden className={cn("size-3.5", SYS_ICON_CLASS[type])} />
      </span>
      <span className={cn("min-w-0 break-words", m.brief && "whitespace-pre-wrap")}>
        {m.brief && <Badge variant="outline" className="mr-1.5 h-5 px-2 text-[11px] font-normal">Brief</Badge>}
        {who ? (
          <>
            <span className="font-mono text-foreground/80">{who === "you" ? "You" : who}</span>
            <RichText text={text.slice(who.length)} quiet />
          </>
        ) : (
          <RichText text={text} quiet />
        )}
      </span>
      <Time at={m.at} />
    </div>
  );
}

function ChatMessage({
  m,
  cont,
  fresh,
  identities,
  onImageLoad,
}: {
  m: Message;
  cont: boolean;
  fresh: boolean;
  identities: Identities;
  onImageLoad: (img: HTMLImageElement) => void;
}) {
  const you = m.from === "you";
  const relayed = m.for === "you" && !you;
  const toYou = (m.toYou || relayed) && !you;
  const name = you ? "You" : m.from;
  const who = identities.get(m.from);
  const harness = who?.harness || harnessFromHandle(m.from);

  return (
    <div
      className={cn(
        "group/msg relative -mx-3 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/50",
        cont ? "mt-0 pt-0.5" : "mt-2.5",
        you && "bg-signal/[0.06] hover:bg-signal/10",
        toYou &&
          "before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-signal",
        fresh && ENTER,
      )}
    >
      <div className="flex justify-center">
        {cont ? (
          <span
            aria-hidden
            className="text-[10.5px] leading-[22px] whitespace-nowrap text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover/msg:opacity-100"
          >
            {shortTime(m.at)}
          </span>
        ) : (
          <Jazzicon handle={you ? "you" : m.from} size={28} />
        )}
      </div>
      <div className="min-w-0">
        {cont ? (
          <span className="sr-only">{`${name}${relayed ? ", relayed for you" : toYou ? ", to you" : ""}: `}</span>
        ) : (
          <div className="flex min-h-[22px] flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("font-mono text-[13px] font-semibold", you && "font-sans text-signal")}>{name}</span>
            {toYou && !relayed && <span className="sr-only">to you</span>}
            {!you && <HarnessDot harness={harness} />}
            {!you && who?.role && <span className="text-xs text-muted-foreground">{who.role}</span>}
            {relayed && (
              <Badge variant="outline" className="h-5 gap-1 px-2 text-[11px] font-normal text-muted-foreground">
                <CornerDownRightIcon aria-hidden />
                relayed for you
              </Badge>
            )}
            <Time at={m.at} />
          </div>
        )}
        {m.text && (
          <div
            className={cn(
              "text-sm leading-[22px] break-words whitespace-pre-wrap text-foreground/90",
              relayed && "mt-0.5 border-l-2 border-border pl-3",
            )}
          >
            <RichText text={m.text} />
          </div>
        )}
        {m.files?.length > 0 && <MessageFiles files={m.files} onImageLoad={onImageLoad} />}
      </div>
    </div>
  );
}

export type FeedHandle = { toBottom: () => void };

const atBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight < 48;

export const Feed = memo(function Feed({
  messages,
  asks,
  identities,
  inviteUrl,
  ref,
}: {
  messages: Message[];
  asks: Ask[];
  identities: Identities;
  /** Join URL to show the invite card with, or null once agents are in. */
  inviteUrl: string | null;
  ref?: Ref<FeedHandle>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const seen = useRef(0);
  const firstMax = useRef<number | null>(null);
  const [pending, setPending] = useState(0);

  const toBottom = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
    setPending(0);
  }, []);
  useImperativeHandle(ref, () => ({ toBottom }), [toBottom]);

  if (firstMax.current === null && messages.length) firstMax.current = messages[messages.length - 1].id;

  useLayoutEffect(() => {
    const added = messages.length - seen.current;
    const first = seen.current === 0;
    seen.current = messages.length;
    if (added <= 0) return;
    if (first || stick.current) toBottom();
    else setPending((p) => p + added);
  }, [messages.length, toBottom]);

  // Images grow the feed after it scrolled; keep the reader pinned if they were at the bottom.
  const onImageLoad = useCallback((img: HTMLImageElement) => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < img.offsetHeight + 48) el.scrollTop = el.scrollHeight;
  }, []);

  const rows = useMemo(() => buildRows(messages, asks), [messages, asks]);
  const max = firstMax.current ?? 0;

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={scroller}
        className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(e) => {
          stick.current = atBottom(e.currentTarget);
          if (stick.current && pending) setPending(0);
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          {inviteUrl && <Invite joinUrl={inviteUrl} />}
          {/* The log stays quiet; App announces only what is addressed to you. */}
          <div role="log" aria-live="off" aria-label="Messages" tabIndex={0} className="rounded-md pt-2 pb-4">
            {rows.map((row) =>
              row.kind === "day" ? (
                <h2
                  key={row.key}
                  className="mt-6 mb-2 flex items-center gap-3 text-xs font-medium text-muted-foreground before:flex-1 before:border-t after:flex-1 after:border-t"
                >
                  {row.label}
                </h2>
              ) : row.kind === "ask" ? (
                <AskCard key={row.key} ask={row.ask} identities={identities} />
              ) : row.kind === "sys" ? (
                <SystemLine key={row.key} m={row.m} fresh={row.m.id > max} />
              ) : (
                <ChatMessage
                  key={row.key}
                  m={row.m}
                  cont={row.cont}
                  fresh={row.m.id > max}
                  identities={identities}
                  onImageLoad={onImageLoad}
                />
              ),
            )}
          </div>
        </div>
      </div>
      {pending > 0 && (
        <Button
          type="button"
          variant="outline"
          className="absolute bottom-3 left-1/2 z-10 h-9 -translate-x-1/2 rounded-full bg-background px-3.5 shadow-lg dark:bg-popover"
          onClick={toBottom}
        >
          <ArrowDownIcon aria-hidden />
          {pending === 1 ? "1 new message" : `${pending} new messages`}
        </Button>
      )}
    </div>
  );
});
