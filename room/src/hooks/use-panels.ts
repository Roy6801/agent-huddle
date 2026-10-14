import { createContext, useCallback, useContext, useState } from "react";

export type Panels = {
  /** Handle whose detail is open in the agents list, if any. */
  expandedAgent: string | null;
  setExpandedAgent: (handle: string | null) => void;
  openAgents: (handle?: string) => void;
  openBoard: (section?: "cap") => void;
  /** Bumped whenever something asks the board to open the round cap editor. */
  capRequest: number;
};

export const PanelsContext = createContext<Panels | null>(null);

export function usePanels() {
  const panels = useContext(PanelsContext);
  if (!panels) throw new Error("usePanels must be used inside PanelsContext");
  return panels;
}

/** Sidebar open state that survives reloads. Storage can be unavailable (private mode, file://). */
export function usePersistedOpen(key: string, fallback: () => boolean) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      if (v === "1" || v === "0") return v === "1";
    } catch {
      // storage blocked
    }
    return fallback();
  });
  const set = useCallback(
    (v: boolean) => {
      setOpen(v);
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {
        // storage blocked
      }
    },
    [key],
  );
  return [open, set] as const;
}
