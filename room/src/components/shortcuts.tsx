import { useEffect } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { isTyping, MOD } from "@/lib/keyboard";

const SHORTCUTS: [keys: string[], what: string][] = [
  [[MOD, "B"], "Show or hide the agents panel"],
  [[MOD, "."], "Show or hide the board"],
  [["?"], "Show these shortcuts"],
  [["Enter"], "Send the message"],
  [["Shift", "Enter"], "New line in the message"],
  [["@"], "Mention an agent, a role or all"],
  [["↑", "↓"], "Choose a mention, or move through agents and tasks"],
  [["Enter"], "Insert the chosen mention (Tab works too)"],
  [["Esc"], "Close suggestions, an editor or a drawer"],
];

const SPOKEN: Record<string, string> = { "⌘": "Command", "↑": "Up arrow", "↓": "Down arrow", "?": "Question mark" };

/** Opens on "?" anywhere outside a text field. */
export function useShortcutsKey(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const returnFocus = useReturnFocus();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" {...returnFocus}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Panel and help shortcuts work when you are not typing in a field.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys.join("+") + what} className="contents">
              <dt className="flex justify-end gap-1">
                {keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border bg-muted px-1.5 font-mono text-xs text-foreground"
                  >
                    {SPOKEN[k] ? (
                      <>
                        <span aria-hidden>{k}</span>
                        <span className="sr-only">{SPOKEN[k]}</span>
                      </>
                    ) : (
                      k
                    )}
                  </kbd>
                ))}
              </dt>
              <dd className="text-sm text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
