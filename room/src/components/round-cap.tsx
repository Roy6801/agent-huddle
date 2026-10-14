import { MinusIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePanels } from "@/hooks/use-panels";
import { useRoom } from "@/hooks/use-room";
import { errMain, postJson } from "@/lib/api";
import { cn } from "@/lib/utils";

const clampCap = (v: number) => Math.min(50, Math.max(1, Math.round(v) || 1));

/** Segments, n/cap and what it means, as in the demo's board. */
export function CapMeter({ compact = false }: { compact?: boolean }) {
  const { state, atCap } = useRoom();
  const { roundCap: cap, streak: n } = state;
  if (cap === undefined) return null;
  const off = cap === null;
  const want = off ? 0 : cap <= 20 ? cap : 10;
  const fill = (count: number) => (off ? 0 : Math.round((Math.min(n, cap) / cap) * count));
  const filled = fill(want);
  const mini = Math.min(want, 10);
  const label = off ? "No cap" : atCap ? "Waiting on you" : `${n} of ${cap}`;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums in-data-ended:opacity-50",
          atCap ? "text-signal" : "text-muted-foreground",
        )}
      >
        {!off && (
          <span aria-hidden className={cn("flex gap-px", atCap && "motion-safe:animate-nudge")}>
            {Array.from({ length: mini }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 w-[3px] rounded-full",
                  i < fill(mini)
                    ? atCap
                      ? "bg-signal"
                      : "bg-foreground/60"
                    : "bg-muted-foreground/25",
                )}
              />
            ))}
          </span>
        )}
        {off ? "No cap" : atCap ? "waiting" : `${n}/${cap}`}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Round cap</p>
        <p className={cn("font-mono text-[11px] tabular-nums", atCap ? "font-semibold text-signal" : "text-muted-foreground")}>
          {label}
        </p>
      </div>
      {!off && (
        <div
          aria-hidden
          className={cn("mt-2 grid gap-1", atCap && "motion-safe:animate-nudge")}
          style={{ gridTemplateColumns: `repeat(${want}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: want }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                i < filled ? (atCap ? "bg-signal" : "bg-foreground/70") : "bg-muted",
              )}
            />
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {off
          ? "Agents never pause for you."
          : atCap
            ? `Agents posted ${n} times in a row and are paused until you reply.`
            : `Agent posts since you last spoke. At ${cap}, agents pause until you reply.`}
      </p>
    </div>
  );
}

export function RoundCap() {
  const { state, pollNow } = useRoom();
  const { capRequest } = usePanels();
  const { roundCap, ended } = state;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("10");
  const [off, setOff] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const offBox = useRef<HTMLButtonElement>(null);

  function show(next: boolean, refocus = true) {
    if (next && ended) return;
    if (next) {
      setOff(roundCap === null);
      setValue(String(roundCap ?? 10));
      setError(null);
      requestAnimationFrame(() => (roundCap === null ? offBox.current : input.current)?.focus());
    } else if (refocus) {
      requestAnimationFrame(() => trigger.current?.focus());
    }
    setOpen(next);
  }

  useEffect(() => {
    // Only a new request opens the editor; a cap change from elsewhere must not.
    if (capRequest) show(true);
  }, [capRequest]);

  useEffect(() => {
    if (ended) setOpen(false);
  }, [ended]);

  async function save() {
    if (ended) return;
    const n = off ? null : Number(value);
    if (n !== null && !(Number.isInteger(n) && n >= 1 && n <= 50)) {
      setError({ message: "Enter a whole number from 1 to 50." });
      input.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const { r, data } = await postJson("/api/settings", { roundCap: n });
      if (!r.ok) return setError({ message: errMain(r, data) });
      show(false);
      pollNow();
    } catch {
      setError({ message: "Could not reach the room server." });
    } finally {
      setSaving(false);
    }
  }

  if (roundCap === undefined) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={(o) => show(o)}
      className="flex flex-col gap-2 in-data-ended:opacity-60"
    >
      <CapMeter />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{roundCap === null ? "No limit set" : `Pause agents after ${roundCap} posts in a row`}</span>
        <CollapsibleTrigger asChild>
          <Button ref={trigger} variant="ghost" size="xs" disabled={ended} className="-mr-2 text-muted-foreground">
            <Settings2Icon aria-hidden />
            {open ? "Close" : "Change"}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <form
          autoComplete="off"
          aria-label="Round cap"
          className="mb-1 grid gap-3 rounded-lg border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              show(false);
            }
          }}
        >
          <label htmlFor="cap-input" className="text-xs font-medium text-muted-foreground">
            Pause agents after
          </label>
          <div className="-mt-1 flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Decrease"
              disabled={off}
              onClick={() => setValue((v) => String(clampCap(Number(v) - 1)))}
            >
              <MinusIcon aria-hidden />
            </Button>
            <input
              ref={input}
              id="cap-input"
              type="number"
              min={1}
              max={50}
              step={1}
              inputMode="numeric"
              disabled={off}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-14 [appearance:textfield] rounded-lg border border-input bg-transparent text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Increase"
              disabled={off}
              onClick={() => setValue((v) => String(clampCap(Number(v) + 1)))}
            >
              <PlusIcon aria-hidden />
            </Button>
            <span className="text-xs text-foreground/80">posts in a row</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground/80">
            <Checkbox ref={offBox} checked={off} onCheckedChange={(c) => setOff(c === true)} />
            No limit
          </label>
          {off && (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-snug text-destructive">
              Agents can keep posting without you. Your only stop is ending the room.
            </p>
          )}
          {error && <ErrorBox error={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => show(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
