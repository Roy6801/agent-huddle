"use client";

import { useSyncExternalStore } from "react";

import { CopyButton } from "@/components/copy-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURL_COMMAND, REPO, repoPublic } from "@/lib/site";

const RUNNERS = [
  { value: "npm", command: `npx skills add ${REPO}` },
  { value: "pnpm", command: `pnpm dlx skills add ${REPO}` },
  { value: "yarn", command: `yarn dlx skills add ${REPO}` },
  { value: "bun", command: `bunx skills add ${REPO}` },
];
const OPTIONS = [...(repoPublic ? RUNNERS : []), { value: "curl", command: CURL_COMMAND }];
const STORAGE_KEY = "agent-huddle:installer";

const CHANGE_EVENT = "agent-huddle:installer";
let chosen: string | null = null;

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? chosen;
    if (saved && OPTIONS.some((o) => o.value === saved)) return saved;
  } catch {}
  return chosen ?? OPTIONS[0].value;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function choose(next: string) {
  chosen = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function InstallSwitcher() {
  const value = useSyncExternalStore(subscribe, readSaved, () => OPTIONS[0].value);

  const command = OPTIONS.find((o) => o.value === value)?.command ?? OPTIONS[0].command;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      {OPTIONS.length > 1 && (
        <Tabs value={value} onValueChange={choose} className="border-b px-1.5 py-1">
          <TabsList aria-label="Package manager" className="h-9! bg-transparent p-0">
            {OPTIONS.map((o) => (
              <TabsTrigger key={o.value} value={o.value} className="h-full px-3 font-mono text-xs">
                {o.value}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="flex items-center gap-2 py-1 pl-4 pr-1">
        <code className="min-w-0 flex-1 py-2 font-mono text-[12.5px] leading-relaxed wrap-anywhere sm:text-sm">
          <span className="select-none text-muted-foreground/70">$ </span>
          {command}
        </code>
        <CopyButton text={command} label="Copy install command" />
      </div>
    </div>
  );
}
