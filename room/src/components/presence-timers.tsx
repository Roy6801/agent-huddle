import { Settings2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";
import type { PresenceTimers as Timers } from "@/lib/types";

const FIELDS: { key: keyof Timers; label: string; min: number; max: number }[] = [
  { key: "workingMinutes", label: "Working window", min: 1, max: 120 },
  { key: "asleepMinutes", label: "Asleep after", min: 1, max: 120 },
  { key: "leaveMinutes", label: "Leave after", min: 5, max: 240 },
];

/** How long an agent shows as working after a call, until it shows as asleep, and until it leaves. */
export function PresenceTimers() {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const { presenceTimers: timers, ended } = state;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<keyof Timers, string>>({ workingMinutes: "", asleepMinutes: "", leaveMinutes: "" });
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ended) setOpen(false);
  }, [ended]);

  if (!timers) return null;

  function show(next: boolean) {
    if (next && ended) return;
    if (next) {
      setValues({
        workingMinutes: String(timers!.workingMinutes),
        asleepMinutes: String(timers!.asleepMinutes),
        leaveMinutes: String(timers!.leaveMinutes),
      });
      setError(null);
      requestAnimationFrame(() => first.current?.focus());
    } else {
      requestAnimationFrame(() => trigger.current?.focus());
    }
    setOpen(next);
  }

  async function save() {
    if (ended) return;
    const body: Partial<Timers> = {};
    for (const f of FIELDS) {
      const n = Number(values[f.key]);
      if (!(Number.isInteger(n) && n >= f.min && n <= f.max)) return setError({ message: `${f.label}: enter a whole number from ${f.min} to ${f.max}.` });
      body[f.key] = n;
    }
    if (body.leaveMinutes! <= body.asleepMinutes!) return setError({ message: "Leave after must be longer than Asleep after." });
    setSaving(true);
    try {
      const { r, data } = await post("/api/settings", body);
      if (!r.ok) return setError({ message: errMain(r, data) });
      show(false);
      pollNow();
    } catch {
      setError({ message: "Could not reach the room server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={show} className="flex flex-col gap-2">
      <h3 id="presence-h" className="text-xs font-medium text-muted-foreground">
        Presence
      </h3>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{`Working ${timers.workingMinutes} min · asleep after ${timers.asleepMinutes} min · leave after ${timers.leaveMinutes} min`}</span>
        <CollapsibleTrigger asChild>
          <Button ref={trigger} variant="ghost" size="xs" disabled={ended} className="-mr-2 shrink-0 text-muted-foreground">
            <Settings2Icon aria-hidden />
            {open ? "Close" : "Change"}
            <span className="sr-only"> presence timers</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <form
          noValidate
          autoComplete="off"
          aria-labelledby="presence-h"
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
          {FIELDS.map((f, i) => (
            <div key={f.key} className="flex items-center justify-between gap-2">
              <label htmlFor={`presence-${f.key}`} className="text-xs text-foreground/80">
                {f.label}
              </label>
              <span className="flex items-center gap-1.5">
                <input
                  ref={i === 0 ? first : undefined}
                  id={`presence-${f.key}`}
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={1}
                  inputMode="numeric"
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "presence-error" : undefined}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="h-8 w-16 [appearance:textfield] rounded-lg border border-input bg-transparent text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="w-14 text-[11px] text-muted-foreground">min</span>
              </span>
            </div>
          ))}
          {error && <ErrorBox id="presence-error" error={error} />}
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
