"use client";

import { track } from "@vercel/analytics";
import { useEffect } from "react";

import { REPO_URL } from "@/lib/site";

function eventFor(link: HTMLAnchorElement) {
  const href = link.getAttribute("href") ?? "";
  if (href === "/agent-huddle.zip") return "download_zip";
  if (href.startsWith(REPO_URL)) return "github_link";
  return null;
}

function isCopyButton(button: HTMLElement) {
  return button.getAttribute("aria-label")?.startsWith("Copy ") ?? false;
}

export function AnalyticsEvents() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest("a");
      const button = e.target.closest("button");
      const name = link && eventFor(link);
      if (name) track(name);
      else if (button && isCopyButton(button)) track("copy_command");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
