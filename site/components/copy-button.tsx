"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "idle" | "copied" | "failed";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const ok = await writeClipboard(text);
    setStatus(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={copy}
        aria-label={label}
        className={cn(
          "h-11 shrink-0 gap-1.5 rounded-lg px-3 font-sans text-xs text-muted-foreground hover:text-foreground",
          status === "copied" && "text-foreground",
          className,
        )}
      >
        {status === "copied" ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        <span aria-hidden>{status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}</span>
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" ? "Copied to clipboard" : status === "failed" ? "Copy failed. Select the text and copy it manually." : ""}
      </span>
    </>
  );
}
