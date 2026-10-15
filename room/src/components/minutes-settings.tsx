import { Settings2Icon, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";

export type Field<K extends string> = { key: K; label: string; unit: string; min: number; max: number };

type EditorProps = {
  /** Prefix of the element ids, e.g. "headless". */
  id: string;
  title: string;
  /** Screen-reader suffix of the Change button, e.g. "headless budgets". */
  noun: string;
  icon?: LucideIcon;
  summary: ReactNode;
  /** Top-aligns the Change button when the summary can wrap over several lines. */
  alignStart?: boolean;
  /** Fills the form fields from the current values each time the form opens. */
  onOpen: () => void;
  /** The request body for POST api/settings, or a message when the fields are not acceptable. */
  toBody: () => object | string;
  /** The form fields; receives the id of the error message while one is shown. */
  children: (errorId: string | undefined) => ReactNode;
};

/** A titled summary line that opens a form saved with POST api/settings. */
export function SettingsEditor({ id, title, noun, icon: Icon = Settings2Icon, summary, alignStart, onOpen, toBody, children }: EditorProps) {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const { ended } = state;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (ended) setOpen(false);
  }, [ended]);

  function show(next: boolean) {
    if (next && ended) return;
    if (next) {
      onOpen();
      setError(null);
      requestAnimationFrame(() => form.current?.querySelector("input")?.focus());
    } else {
      requestAnimationFrame(() => trigger.current?.focus());
    }
    setOpen(next);
  }

  async function save() {
    if (ended) return;
    const body = toBody();
    if (typeof body === "string") return setError({ message: body });
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
      <div className={`flex ${alignStart ? "items-start" : "items-center"} justify-between gap-2 text-[11px] text-muted-foreground`}>
        {summary}
        <CollapsibleTrigger asChild>
          <Button ref={trigger} variant="ghost" size="xs" disabled={ended} className="-mr-2 shrink-0 text-muted-foreground">
            <Icon aria-hidden />
            {open ? "Close" : "Change"}
            <span className="sr-only">{` ${noun}`}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <form
          ref={form}
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
          {children(error ? `${id}-error` : undefined)}
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
  const [values, setValues] = useState<Record<string, string>>({});

  if (!current) return null;

  function toBody() {
    const body = {} as Record<K, number>;
    for (const f of fields) {
      const n = Number(values[f.key]);
      if (!(Number.isInteger(n) && n >= f.min && n <= f.max)) return `${f.label}: enter a whole number from ${f.min} to ${f.max}.`;
      body[f.key] = n;
    }
    return validate?.(body) || body;
  }

  return (
    <SettingsEditor
      id={id}
      title={title}
      noun={noun}
      summary={<span>{summary(current)}</span>}
      onOpen={() => setValues(Object.fromEntries(fields.map((f) => [f.key, String(current[f.key])])))}
      toBody={toBody}
    >
      {(errorId) =>
        fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-2">
            <label htmlFor={`${id}-${f.key}`} className="text-xs text-foreground/80">
              {f.label}
            </label>
            <span className="flex items-center gap-1.5">
              <input
                id={`${id}-${f.key}`}
                type="number"
                min={f.min}
                max={f.max}
                step={1}
                inputMode="numeric"
                aria-invalid={!!errorId || undefined}
                aria-describedby={errorId}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="h-8 w-16 [appearance:textfield] rounded-lg border border-input bg-transparent text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="w-14 text-[11px] text-muted-foreground">{f.unit}</span>
            </span>
          </div>
        ))
      }
    </SettingsEditor>
  );
}
