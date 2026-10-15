import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { SettingsEditor } from "@/components/minutes-settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePanels } from "@/hooks/use-panels";
import { useRoom } from "@/hooks/use-room";
import { cn } from "@/lib/utils";

const DEFAULT_CAP = 30;
const MAX_CAP = 100;
const clampCap = (v: number) => Math.min(MAX_CAP, Math.max(1, Math.round(v) || 1));

/** The cap state in words, for meters and button names. Null until the first state arrives. */
export function capText(cap: number | null | undefined, n: number, atCap: boolean) {
  if (cap === undefined) return null;
  if (cap === null) return "No cap";
  return atCap ? `Waiting on you, ${n} of ${cap} agent posts` : `${n} of ${cap} agent posts`;
}

/** Segments, n/cap and what it means, as in the demo's board. */
export function CapMeter() {
  const { state, atCap } = useRoom();
  const { roundCap: cap, streak: n } = state;
  if (cap === undefined) return null;
  const off = cap === null;
  const want = off ? 0 : cap <= 20 ? cap : 10;
  const filled = off ? 0 : Math.round((Math.min(n, cap) / cap) * want);
  const label = off ? "No cap" : atCap ? "Waiting on you" : `${n} of ${cap}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="cap-h" className="text-xs font-medium text-muted-foreground">
          Round cap
        </h3>
        <p
          aria-hidden={!off}
          className={cn("font-mono text-[11px] tabular-nums", atCap ? "font-semibold text-signal" : "text-muted-foreground")}
        >
          {label}
        </p>
      </div>
      {!off && (
        <div
          role="meter"
          aria-labelledby="cap-h"
          aria-describedby="cap-desc"
          aria-valuemin={0}
          aria-valuemax={cap}
          aria-valuenow={Math.min(n, cap)}
          aria-valuetext={capText(cap, n, atCap) ?? undefined}
          className={cn("mt-2 grid gap-1", atCap && "motion-safe:animate-nudge")}
          style={{ gridTemplateColumns: `repeat(${want}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: want }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300 forced-color-adjust-none",
                i < filled ? (atCap ? "bg-signal" : "bg-foreground/70") : "bg-muted",
              )}
            />
          ))}
        </div>
      )}
      <p id="cap-desc" className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {off
          ? "Agents never pause for you."
          : atCap
            ? `Agents posted ${n} times in a row and are paused until you reply.`
            : `Agent posts since you last spoke. At ${cap}, agents pause until you reply.`}
      </p>
    </div>
  );
}

const RING_R = 7;
const RING_C = 2 * Math.PI * RING_R;

/** Phone header: the cap as a small progress ring, "!" when agents wait on you, "∞" with no cap. */
export function CapRing() {
  const { state, atCap } = useRoom();
  const { roundCap: cap, streak: n } = state;
  if (cap === undefined) return null;
  if (cap === null) {
    return (
      <span aria-hidden className="grid size-[18px] place-items-center text-base leading-none text-muted-foreground">
        ∞
      </span>
    );
  }
  if (atCap) {
    return (
      <span
        aria-hidden
        className="grid size-[18px] place-items-center rounded-full bg-signal text-[11px] leading-none font-bold text-signal-foreground forced-color-adjust-none motion-safe:animate-nudge"
      >
        !
      </span>
    );
  }
  const frac = Math.min(n, cap) / cap;
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-[18px] -rotate-90 forced-color-adjust-none">
      <circle cx="9" cy="9" r={RING_R} fill="none" strokeWidth="2.5" className="stroke-muted-foreground/30" />
      {frac > 0 && (
        <circle
          cx="9"
          cy="9"
          r={RING_R}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - frac)}
          className="stroke-signal transition-[stroke-dashoffset] duration-300"
        />
      )}
    </svg>
  );
}

export function RoundCap() {
  const { state } = useRoom();
  const { capRequest } = usePanels();
  const { roundCap } = state;
  const [value, setValue] = useState(String(DEFAULT_CAP));
  const [off, setOff] = useState(false);

  if (roundCap === undefined) return null;

  function toBody() {
    const n = off ? null : Number(value);
    if (n !== null && !(Number.isInteger(n) && n >= 1 && n <= MAX_CAP)) return `Enter a whole number from 1 to ${MAX_CAP}.`;
    return { roundCap: n };
  }

  return (
    <SettingsEditor
      id="cap"
      lead={<CapMeter />}
      label="Round cap"
      noun="round cap"
      summary={<span>{roundCap === null ? "No limit set" : `Pause agents after ${roundCap} posts in a row`}</span>}
      onOpen={() => {
        setOff(roundCap === null);
        setValue(String(roundCap ?? DEFAULT_CAP));
      }}
      openRequest={capRequest}
      toBody={toBody}
    >
      {(errorId) => (
        <>
          <label htmlFor="cap-input" className="text-xs font-medium text-muted-foreground">
            Pause agents after
          </label>
          <div className="-mt-1 flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Decrease round cap"
              aria-controls="cap-input"
              disabled={off}
              onClick={() => setValue((v) => String(clampCap(Number(v) - 1)))}
            >
              <MinusIcon aria-hidden />
            </Button>
            <input
              id="cap-input"
              type="number"
              min={1}
              max={MAX_CAP}
              step={1}
              inputMode="numeric"
              disabled={off}
              aria-invalid={!!errorId || undefined}
              aria-describedby={cn("cap-unit", errorId)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-14 [appearance:textfield] rounded-lg border border-input bg-transparent text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Increase round cap"
              aria-controls="cap-input"
              disabled={off}
              onClick={() => setValue((v) => String(clampCap(Number(v) + 1)))}
            >
              <PlusIcon aria-hidden />
            </Button>
            <span id="cap-unit" className="text-xs text-foreground/80">
              posts in a row
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground/80">
            <Checkbox
              data-autofocus={off || undefined}
              checked={off}
              aria-describedby={off ? "cap-off-warning" : undefined}
              onCheckedChange={(c) => setOff(c === true)}
            />
            No limit
          </label>
          {off && (
            <p id="cap-off-warning" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-snug text-destructive">
              Agents can keep posting without you. Your only stop is ending the room.
            </p>
          )}
        </>
      )}
    </SettingsEditor>
  );
}
