import { Settings2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";

export type Field<K extends string> = { key: K; label: string; unit: string; min: number; max: number };

type Props<K extends string> = {
  /** Prefix of the element ids, e.g. "headless". */
  id: string;
  title: string;
  /** Screen-reader suffix of the Change button, e.g. "headless budgets". */
  noun: string;
  fields: Field<K>[];
  values: Record<K, number> | undefined;
  summary: (values: Record<K, number>) => string;
  /** Returns a message when the whole body is not acceptable, before it is sent. */
  validate?: (body: Record<K, number>) => string | null;
};

/** A titled summary line that opens a form of whole-number settings saved with POST api/settings. */
export function MinutesSettings<K extends string>({ id, title, noun, fields, values: current, summary, validate }: Props<K>) {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const { ended } = state;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ended) setOpen(false);
  }, [ended]);

  if (!current) return null;

  function show(next: boolean) {
    if (next && ended) return;
    if (next) {
      setValues(Object.fromEntries(fields.map((f) => [f.key, String(current![f.key])])));
      setError(null);
      requestAnimationFrame(() => first.current?.focus());
    } else {
      requestAnimationFrame(() => trigger.current?.focus());
    }
    setOpen(next);
  }

  async function save() {
    if (ended) return;
    const body = {} as Record<K, number>;
    for (const f of fields) {
      const n = Number(values[f.key]);
      if (!(Number.isInteger(n) && n >= f.min && n <= f.max)) return setError({ message: `${f.label}: enter a whole number from ${f.min} to ${f.max}.` });
      body[f.key] = n;
    }
    const invalid = validate?.(body);
    if (invalid) return setError({ message: invalid });
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
      <h3 id={`${id}-h`} className="text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{summary(current)}</span>
        <CollapsibleTrigger asChild>
          <Button ref={trigger} variant="ghost" size="xs" disabled={ended} className="-mr-2 shrink-0 text-muted-foreground">
            <Settings2Icon aria-hidden />
            {open ? "Close" : "Change"}
            <span className="sr-only">{` ${noun}`}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <form
          noValidate
          autoComplete="off"
          aria-labelledby={`${id}-h`}
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
          {fields.map((f, i) => (
            <div key={f.key} className="flex items-center justify-between gap-2">
              <label htmlFor={`${id}-${f.key}`} className="text-xs text-foreground/80">
                {f.label}
              </label>
              <span className="flex items-center gap-1.5">
                <input
                  ref={i === 0 ? first : undefined}
                  id={`${id}-${f.key}`}
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={1}
                  inputMode="numeric"
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="h-8 w-16 [appearance:textfield] rounded-lg border border-input bg-transparent text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="w-14 text-[11px] text-muted-foreground">{f.unit}</span>
              </span>
            </div>
          ))}
          {error && <ErrorBox id={`${id}-error`} error={error} />}
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
