import { useEffect, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Switch } from "@/components/ui/switch";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";

/** Worktree per agent: each agent that joins gets its own git worktree and branch of the room folder's repository. */
export function WorktreeSetting() {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const { worktrees, ended } = state;
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);

  useEffect(() => setPending(null), [worktrees]);

  if (worktrees === undefined) return null;
  const on = pending ?? worktrees === "per-agent";

  async function change(next: boolean) {
    setPending(next);
    setError(null);
    try {
      const { r, data } = await post("/api/settings", { worktrees: next ? "per-agent" : "off" });
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
    <section aria-labelledby="worktrees-h" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label id="worktrees-h" htmlFor="worktrees-switch" className="text-xs font-medium text-muted-foreground">
          Worktree per agent
        </label>
        <Switch
          id="worktrees-switch"
          size="sm"
          checked={on}
          disabled={ended || pending !== null}
          aria-describedby="worktrees-desc"
          onCheckedChange={change}
        />
      </div>
      <p id="worktrees-desc" className="text-[11px] leading-snug text-muted-foreground">
        {on
          ? "Each agent that joins from now on works in its own git worktree, on its own branch. Ending the room keeps them."
          : "Agents work in the room folder. Turn on when several agents edit the same git repository."}
      </p>
      {error && <ErrorBox error={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
