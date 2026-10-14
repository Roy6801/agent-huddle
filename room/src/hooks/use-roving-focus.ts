import { useCallback, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent } from "react";

const ITEM = "[data-roving-item]";
const KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/**
 * Makes a vertical list of buttons a single tab stop: Up, Down, Home and End move between items
 * marked data-roving-item, and Tab leaves the list from the last focused one.
 */
export function useRovingFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const active = useRef<HTMLElement | null>(null);

  const sync = useCallback(() => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
    if (!items.length) return;
    if (!active.current || !items.includes(active.current)) active.current = items[0];
    for (const el of items) el.tabIndex = el === active.current ? 0 : -1;
  }, []);

  // Items come and go with every poll; keep exactly one of them tabbable.
  useLayoutEffect(sync);

  const onFocus = useCallback(
    (e: FocusEvent) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(ITEM);
      if (!item || item === active.current) return;
      active.current = item;
      sync();
    },
    [sync],
  );

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>(ITEM);
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
    const i = item ? items.indexOf(item) : -1;
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }, []);

  return { ref, onFocus, onKeyDown };
}
