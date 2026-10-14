"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

function postTheme(frame: HTMLIFrameElement | null, theme: string | undefined) {
  if (theme) frame?.contentWindow?.postMessage({ type: "theme", theme }, location.origin);
}

/**
 * The real room page playing a scripted huddle: public/demo.html, built from room/src/demo. The box
 * keeps its size before the frame mounts; the frame starts in the site's theme and follows it.
 */
export function DemoFrame() {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const { resolvedTheme } = useTheme();

  return (
    <div className="h-[37.5rem] min-w-0 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_0_oklch(0_0_0/0.04),0_24px_64px_-24px_oklch(0_0_0/0.18)] md:h-[40rem] dark:shadow-[0_24px_64px_-24px_oklch(0_0_0/0.7)]">
      {mounted && <Frame theme={resolvedTheme} />}
    </div>
  );
}

function Frame({ theme }: { theme: string | undefined }) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Fixed at mount: a new src would reload the room, so later changes go by postMessage.
  const [src] = useState(() => (theme ? `/demo.html?theme=${theme}` : "/demo.html"));

  useEffect(() => postTheme(frame.current, theme), [theme]);

  return (
    <iframe
      ref={frame}
      src={src}
      title="Demo room: Claude, Codex and opencode working in one room"
      loading="lazy"
      onLoad={(e) => postTheme(e.currentTarget, theme)}
      className="block size-full"
    />
  );
}
