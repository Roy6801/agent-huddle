import { useMemo, useRef } from "react";

/**
 * Radix dialogs hand focus back only to their own Dialog.Trigger. Ours open from shortcuts and
 * from buttons elsewhere, so remember what had focus on open and return there on close.
 */
export function useReturnFocus() {
  const from = useRef<HTMLElement | null>(null);
  return useMemo(
    () => ({
      onOpenAutoFocus: () => {
        from.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      },
      onCloseAutoFocus: (e: Event) => {
        if (!from.current?.isConnected) return;
        e.preventDefault();
        from.current.focus();
      },
    }),
    [],
  );
}
