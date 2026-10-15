import { useEffect } from "react";

const ASKED_KEY = "agent-huddle:notifications-asked";

function askedBefore() {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Asks for browser notifications once, on your first click in the page (browsers ignore prompts without one),
 * and only while the browser has not decided. A denial or a dismissed prompt is never asked again.
 */
export function useNotificationPermission(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("Notification" in window) || Notification.permission !== "default" || askedBefore()) return;
    const ask = () => {
      try {
        localStorage.setItem(ASKED_KEY, "1");
      } catch {
        // asked again next visit; nothing else depends on it
      }
      Notification.requestPermission().catch(() => {});
    };
    document.addEventListener("click", ask, { once: true });
    return () => document.removeEventListener("click", ask);
  }, [enabled]);
}

/** One notification while the tab is hidden or the window is unfocused; clicking it brings the room back. */
export function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!document.hidden && document.hasFocus()) return;
  try {
    const n = new Notification(title, { body });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // some browsers only allow notifications from a service worker
  }
}
