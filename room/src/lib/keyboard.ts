/** Single-key shortcuts must not fire while the user is typing into a field. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The Cmd or Ctrl label for shortcut hints. */
export const MOD = isMac ? "⌘" : "Ctrl";
