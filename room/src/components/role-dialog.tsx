import { TagIcon } from "lucide-react";
import { useId, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";
import type { Agent } from "@/lib/types";

const ROLE_RE = /^[a-z0-9-]{1,20}$/;

/** Sets or clears one agent's role from the page; the room says so in the feed and the agent is woken. */
export function RoleDialog({ agent }: { agent: Agent }) {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestions = [...new Set(state.agents.filter((a) => a.status !== "left" && a.role && a.role !== "lead").map((a) => a.role as string))].filter(
    (r) => r !== agent.role,
  );

  function show(next: boolean) {
    if (next) {
      setValue(agent.role ?? "");
      setError(null);
    }
    setOpen(next);
  }

  async function save(role: string | null) {
    if (role !== null && !ROLE_RE.test(role)) {
      setError({ message: "Use 1-20 lowercase letters, digits or dashes." });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { r, data } = await post(`/api/agents/${agent.handle}/role`, { role });
      if (!r.ok) return setError({ message: errMain(r, data), valid: null });
      setOpen(false);
      pollNow();
    } catch {
      setError({ message: "Could not reach the room server." });
    } finally {
      setSaving(false);
    }
  }

  if (state.ended || agent.status === "left") return null;
  return (
    <Dialog open={open} onOpenChange={show}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" className="col-span-2 mt-1 justify-self-start">
          <TagIcon aria-hidden />
          {agent.role ? "Change role" : "Set role"}
          <span className="sr-only">{` of ${agent.handle}`}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle className="break-words">Role of {agent.handle}</DialogTitle>
          <DialogDescription className="text-xs">Others reach it with @role, and it is told right away.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          autoComplete="off"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const role = value.trim();
            if (!role) return setError({ message: "Enter a role, or clear it." });
            save(role);
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-role`} className="text-xs text-foreground/80">
              Role
            </label>
            <input
              id={`${id}-role`}
              type="text"
              autoFocus
              spellCheck={false}
              maxLength={40}
              placeholder="builder"
              aria-invalid={!!error || undefined}
              aria-describedby={[`${id}-help`, error ? `${id}-error` : ""].filter(Boolean).join(" ")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <p id={`${id}-help`} className="text-[11px] text-muted-foreground">
              1-20 lowercase letters, digits or dashes.
            </p>
          </div>
          {suggestions.length > 0 && (
            <div role="group" aria-label="Roles in the room" className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground">In the room:</span>
              {suggestions.map((r) => (
                <Button key={r} type="button" variant="outline" size="xs" className="font-mono" onClick={() => setValue(r)}>
                  {r}
                </Button>
              ))}
            </div>
          )}
          {error && <ErrorBox id={`${id}-error`} error={error} />}
          <div className="flex flex-wrap justify-end gap-2">
            {agent.role && (
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => save(null)} className="mr-auto">
                Clear role
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => show(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
