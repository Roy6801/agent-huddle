import { PencilIcon, PinIcon } from "lucide-react";
import { useId, useState } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Count } from "@/components/tasks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";
import { fmtTime, fullTime } from "@/lib/format";
import type { Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BRIEF = 20000;
const LONG = 300;

function BriefDialog({ open, onOpenChange, brief }: { open: boolean; onOpenChange: (open: boolean) => void; brief: Brief | null }) {
  const { pollNow, endHuddle } = useRoom();
  const { post } = useSource();
  const id = useId();
  const [openedWith] = useState(brief);
  const current = openedWith?.text ?? "";
  const changed = brief?.id !== openedWith?.id;
  const [text, setText] = useState(current);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const blocked = saving || !text.trim() || text === current;

  async function save() {
    if (blocked) return;
    setSaving(true);
    try {
      const { r, data } = await post("/api/brief", { text });
      if (r.status === 410) {
        endHuddle();
      } else if (r.ok) {
        onOpenChange(false);
        pollNow();
      } else {
        setError({ message: errMain(r, data) });
      }
    } catch {
      setError({ message: "Could not reach the room server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{current ? "Edit brief" : "Set brief"}</DialogTitle>
          <DialogDescription>Pinned above the chat and sent to every agent that joins. Plain text.</DialogDescription>
        </DialogHeader>
        <form
          autoComplete="off"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-text`} className="text-xs font-medium text-muted-foreground">
              Brief
            </label>
            <Textarea
              id={`${id}-text`}
              value={text}
              rows={8}
              maxLength={MAX_BRIEF}
              aria-describedby={cn(`${id}-count`, error && `${id}-error`)}
              onChange={(e) => setText(e.target.value)}
              className="max-h-[50svh] font-normal text-foreground"
            />
            <Count id={`${id}-count`} text={text} max={MAX_BRIEF} raw />
            {changed && (
              <p className="text-xs text-muted-foreground">The brief changed while you were editing. Saving replaces it.</p>
            )}
          </div>
          {error && <ErrorBox id={`${id}-error`} error={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={blocked}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PinnedBrief() {
  const { state } = useRoom();
  const { brief, ended, loaded } = state;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();

  if (!loaded || (ended && !brief)) return null;
  const long = !!brief && (brief.text.length > LONG || brief.text.split("\n").length > 4);

  return (
    <>
      {brief ? (
        <section aria-label="Room brief" className="shrink-0 border-b bg-muted/40 px-4 py-2.5">
          <div className="mx-auto w-full max-w-3xl sm:px-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <PinIcon aria-hidden className="size-3.5" />
              <h2 className="font-semibold text-foreground">Brief</h2>
              <span>set by {brief.by === "you" ? "you" : `@${brief.by}`}</span>
              <time dateTime={brief.at} title={fullTime(brief.at)} className="tabular-nums">
                {fmtTime(brief.at)}
              </time>
              {!ended && (
                <Button type="button" variant="ghost" size="xs" className="ml-auto text-muted-foreground" onClick={() => setOpen(true)}>
                  <PencilIcon aria-hidden />
                  Edit
                </Button>
              )}
            </div>
            <p
              id={bodyId}
              className={cn(
                "mt-1.5 text-sm leading-5 break-words whitespace-pre-wrap text-foreground/90",
                long && !expanded && "line-clamp-4",
                expanded && "max-h-[40svh] overflow-y-auto overscroll-contain",
              )}
            >
              {brief.text}
            </p>
            {long && (
              <Button
                type="button"
                variant="link"
                size="xs"
                aria-expanded={expanded}
                aria-controls={bodyId}
                className="mt-1 h-auto p-0 text-xs"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show all"}
              </Button>
            )}
          </div>
        </section>
      ) : (
        <section aria-label="Room brief" className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
          <PinIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">No brief yet. The lead or you can set one.</span>
          <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)}>
            Set brief
          </Button>
        </section>
      )}
      {open && <BriefDialog open onOpenChange={setOpen} brief={brief} />}
    </>
  );
}
