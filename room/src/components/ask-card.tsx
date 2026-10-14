import { BanIcon, CheckIcon, ChevronRightIcon, ClockIcon, ShieldQuestionIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { HarnessDot, Jazzicon } from "@/components/identity";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRoom, useSource, type Identities } from "@/hooks/use-room";
import { fmtTime, fullTime, harnessFromHandle } from "@/lib/format";
import type { Ask, AskKind, AskOption } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: AskKind[] = ["allow_once", "allow_always", "reject_once", "reject_always"];

const LABEL: Record<AskKind, string> = {
  allow_once: "Allow once",
  allow_always: "Always",
  reject_once: "Deny",
  reject_always: "Always deny",
};

const HINT: Partial<Record<AskKind, string>> = {
  allow_always: "Allow for the rest of this session",
  reject_always: "Deny for the rest of this session",
};

const SETTLED: Record<AskKind, string> = {
  allow_once: "Allowed once by you",
  allow_always: "Always allowed by you",
  reject_once: "Denied by you",
  reject_always: "Always denied by you",
};

/** The ask the human just answered; its settled row takes focus when it replaces the buttons. */
let answeredAsk: number | null = null;

function settledText(ask: Ask) {
  if (ask.status === "open") return "Room ended";
  if (ask.status === "timeout") return "Timed out — denied";
  if (ask.status === "cancelled") return "Cancelled";
  return ask.answer ? SETTLED[ask.answer.kind] : "Answered";
}

function Settled({ ask }: { ask: Ask }) {
  const allowed = ask.status === "answered" && ask.answer?.kind.startsWith("allow");
  const Icon = allowed ? CheckIcon : ask.status === "answered" ? BanIcon : ClockIcon;
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (answeredAsk !== ask.id) return;
    answeredAsk = null;
    row.current?.focus();
  }, [ask.id]);
  return (
    <div
      ref={row}
      tabIndex={-1}
      className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-3 py-0.5 text-xs leading-5 text-muted-foreground outline-none"
    >
      <span className="flex justify-center pt-[3px]">
        <Icon aria-hidden className={cn("size-3.5", allowed && "text-presence")} />
      </span>
      <span className="min-w-0 truncate" title={`${ask.by} asked: ${ask.title}`}>
        <span className="text-foreground/80">{settledText(ask)}</span>
        <span className="sr-only">{`: ${ask.by} asked to ${ask.title}`}</span>
        <span aria-hidden>
          {" · "}
          <span className="font-mono">{ask.by}</span> asked to {ask.title}
        </span>
      </span>
      <time dateTime={ask.at} title={fullTime(ask.at)} className="text-[11px] tabular-nums">
        {fmtTime(ask.at)}
      </time>
    </div>
  );
}

function Open({ ask, identities }: { ask: Ask; identities: Identities }) {
  const { pollNow } = useRoom();
  const { post } = useSource();
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const uid = useId();
  const harness = identities.get(ask.by)?.harness || harnessFromHandle(ask.by);
  const options = ORDER.flatMap((k) => ask.options.filter((o) => o.kind === k));

  async function answer(o: AskOption) {
    if (sending) return;
    setSending(o.optionId);
    setError("");
    try {
      const { r, data } = await post(`/api/asks/${ask.id}`, { optionId: o.optionId });
      if (r.ok) {
        answeredAsk = ask.id;
        pollNow();
        return;
      }
      if (r.status === 409) {
        setError("This was already settled.");
        pollNow();
      } else setError(data?.error || "Could not send your answer. Try again.");
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setSending(null);
  }

  return (
    <div className="-mx-3 mt-2.5 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 px-3 py-1.5">
      <div className="flex justify-center">
        <Jazzicon handle={ask.by} size={28} />
      </div>
      <div className="min-w-0 rounded-lg border border-signal/30 bg-card px-3 py-2.5 text-card-foreground">
        <div className="flex min-h-[22px] flex-wrap items-center gap-x-2 gap-y-0.5">
          <ShieldQuestionIcon aria-hidden className="size-4 text-signal" />
          <span className="font-mono text-[13px] font-semibold">{ask.by}</span>
          <HarnessDot harness={harness} />
          <time dateTime={ask.at} title={fullTime(ask.at)} className="text-[11px] text-muted-foreground tabular-nums">
            {fmtTime(ask.at)}
          </time>
        </div>
        <p className="mt-0.5 text-sm leading-[22px] break-words">
          <span className="sr-only">{`${ask.by} asks you. `}</span>
          <span className="text-muted-foreground">wants to: </span>
          <span className="font-medium">{ask.title}</span>
        </p>
        {ask.detail && (
          <Collapsible className="mt-1">
            <CollapsibleTrigger className="group/details -ml-1 inline-flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              <ChevronRightIcon aria-hidden className="size-3.5 transition-transform group-data-[state=open]/details:rotate-90" />
              Details
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 max-h-60 overflow-y-auto rounded-md bg-muted/60 p-2 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-foreground/90">
                {ask.detail}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        <div role="group" aria-label={`Answer ${ask.by}`} className="mt-2.5 flex flex-wrap gap-2">
          {options.map((o) => (
            <Button
              key={o.optionId}
              type="button"
              size="sm"
              variant={o.kind === "allow_once" ? "default" : o.kind.startsWith("reject") ? "destructive" : "outline"}
              disabled={!!sending}
              title={HINT[o.kind]}
              aria-describedby={HINT[o.kind] ? `${uid}-${o.optionId}` : undefined}
              onClick={() => answer(o)}
            >
              {LABEL[o.kind]}
              {HINT[o.kind] && (
                <span id={`${uid}-${o.optionId}`} className="sr-only">
                  {HINT[o.kind]}
                </span>
              )}
            </Button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function AskCard({ ask, identities }: { ask: Ask; identities: Identities }) {
  const { state } = useRoom();
  return ask.status === "open" && !state.ended ? <Open ask={ask} identities={identities} /> : <Settled ask={ask} />;
}
