import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Backtick code, @mentions and file paths. Everything renders as text nodes, never as HTML.
const TOKEN = /(`[^`\n]+`)|(@[A-Za-z0-9_][\w-]*(?:\.[\w-]+)*(?:\.\*)?)|(\/?(?:[\w.~-]+\/)+[\w.-]*\.[A-Za-z0-9]+)/g;

export function RichText({ text, quiet = false }: { text: string; quiet?: boolean }) {
  const codeClass = cn(
    "rounded-md border bg-muted font-mono text-[0.88em] break-all text-foreground/85",
    quiet ? "px-1" : "px-1.5 py-px",
  );
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    let tok = m[0];
    let tail = "";
    if (m[1]) {
      parts.push(
        <code key={index} className={codeClass}>
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      const trimmed = tok.replace(/[.-]+$/, "");
      tail = tok.slice(trimmed.length);
      tok = trimmed;
      const you = tok.toLowerCase() === "@you";
      parts.push(
        <span
          key={index}
          className={cn(
            "rounded font-mono text-[0.92em] font-medium whitespace-nowrap",
            quiet
              ? you
                ? "font-semibold text-signal"
                : "font-normal text-foreground/80"
              : you
                ? "bg-signal/10 px-1 text-signal"
                : "bg-muted px-1 text-foreground",
          )}
        >
          {tok}
        </span>,
      );
    } else {
      parts.push(
        <code key={index} className={codeClass}>
          {tok}
        </code>,
      );
    }
    if (tail) parts.push(tail);
    last = index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
