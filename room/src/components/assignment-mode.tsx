import { useEffect, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Switch } from "@/components/ui/switch";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";

/** Strict assignment keeps an assigned task to its assignee; off (regular), a free agent may take it over. */
export function AssignmentMode() {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const { assignment, ended } = state;
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);

  useEffect(() => setPending(null), [assignment]);

  if (assignment === undefined) return null;
  const strict = pending ?? assignment === "strict";

  async function change(next: boolean) {
    setPending(next);
    setError(null);
    try {
      const { r, data } = await post("/api/settings", { assignment: next ? "strict" : "regular" });
      if (!r.ok) {
        setPending(null);
        return setError({ message: errMain(r, data) });
      }
      pollNow();
    } catch {
      setPending(null);
      setError({ message: "Could not reach the room server." });
    }
  }

  return (
    <section aria-labelledby="assignment-h" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label id="assignment-h" htmlFor="assignment-switch" className="text-xs font-medium text-muted-foreground">
          Strict assignment
        </label>
        <Switch
          id="assignment-switch"
          size="sm"
          checked={strict}
          disabled={ended || pending !== null}
          aria-describedby="assignment-desc"
          onCheckedChange={change}
        />
      </div>
      <p id="assignment-desc" className="text-[11px] leading-snug text-muted-foreground">
        {strict
          ? "Only its assignee can claim an assigned task."
          : "Free agents can take any ready task, even one assigned to someone else."}
      </p>
      {error && <ErrorBox error={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
