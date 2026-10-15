import { FolderIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";

/** The folder agents work in, shown in full, and a form that moves the room to another one. */
export function RoomFolder() {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const { ended, folder } = state;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ended) setOpen(false);
  }, [ended]);

  function show(next: boolean) {
    if (next && ended) return;
    if (next) {
      setValue(folder ?? "");
      setError(null);
      requestAnimationFrame(() => input.current?.focus());
    } else {
      requestAnimationFrame(() => trigger.current?.focus());
    }
    setOpen(next);
  }

  async function save() {
    if (ended) return;
    const path = value.trim();
    if (!path.startsWith("/")) return setError({ message: "Enter the full path, starting with /." });
    setSaving(true);
    try {
      const { r, data } = await post("/api/settings", { folder: path });
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
      <h3 id="folder-h" className="text-xs font-medium text-muted-foreground">
        Room folder
      </h3>
      <div className="flex items-start justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 font-mono break-all">{folder || "None set"}</span>
        <CollapsibleTrigger asChild>
          <Button ref={trigger} variant="ghost" size="xs" disabled={ended} className="-mr-2 shrink-0 text-muted-foreground">
            <FolderIcon aria-hidden />
            {open ? "Close" : "Change"}
            <span className="sr-only"> room folder</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <form
          noValidate
          autoComplete="off"
          aria-labelledby="folder-h"
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
          <div className="grid gap-1.5">
            <label htmlFor="folder-path" className="text-xs text-foreground/80">
              Folder (full path)
            </label>
            <input
              ref={input}
              id="folder-path"
              type="text"
              spellCheck={false}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "folder-error folder-help" : "folder-help"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <p id="folder-help" className="text-[11px] text-muted-foreground">
              Every agent is told, and a task to move the files goes to the lead.
            </p>
          </div>
          {error && <ErrorBox id="folder-error" error={error} />}
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
