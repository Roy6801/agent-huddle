import { UserIcon, UsersIcon } from "lucide-react";
import { useId } from "react";

import { harnessKey, type HarnessKey } from "@/lib/format";
import { jazzicon } from "@/lib/jazzicon";
import type { AgentPresence } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Deterministic avatar for a handle, identical to the site. "you" gets the accent avatar. */
export function Jazzicon({ handle, size = 20, className }: { handle: string; size?: number; className?: string }) {
  const clipId = useId();
  const box = { width: size, height: size };

  if (handle === "you") {
    return (
      <span
        aria-hidden
        style={box}
        className={cn("inline-grid shrink-0 place-items-center rounded-full bg-signal text-signal-foreground", className)}
      >
        <UserIcon className="size-[58%]" strokeWidth={2.25} />
      </span>
    );
  }

  const { background, shapes } = jazzicon(handle);
  return (
    <svg aria-hidden viewBox="0 0 100 100" style={box} className={cn("block shrink-0 rounded-full", className)}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="100" fill={background} />
        {shapes.map((shape, i) => (
          <rect key={i} width="100" height="100" fill={shape.fill} transform={shape.transform} />
        ))}
      </g>
    </svg>
  );
}

export function GroupAvatar({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-grid shrink-0 place-items-center rounded-full border bg-muted text-muted-foreground"
    >
      <UsersIcon className="size-[60%]" />
    </span>
  );
}

const HARNESS_DOT: Record<HarnessKey, string> = {
  claude: "bg-harness-claude",
  codex: "bg-harness-codex",
  agy: "bg-harness-agy",
  gemini: "bg-harness-gemini",
  opencode: "bg-harness-opencode",
  dsh: "bg-harness-dsh",
  other: "bg-harness-other",
};

/** Harness colour dot. Labelled unless the harness name is written right next to it. */
export function HarnessDot({
  harness,
  decorative = false,
  className,
}: {
  harness: string;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      title={harness}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${harness} harness` })}
      className={cn(
        "size-1.5 shrink-0 rounded-full forced-color-adjust-none",
        HARNESS_DOT[harnessKey(harness)],
        className,
      )}
    />
  );
}

// Shape as well as colour: listening is full, working a pulsing ring, waiting a ring with a dot, asleep half full, left an empty ring.
const PRESENCE: Record<AgentPresence, string> = {
  listening: "bg-presence",
  working: "bg-presence/40 ring-inset ring-[1.5px] ring-presence motion-safe:animate-pulse",
  waiting: "bg-[radial-gradient(circle,var(--signal)_35%,transparent_40%)] ring-inset ring-[1.5px] ring-signal",
  asleep: "bg-[linear-gradient(to_top,var(--idle)_50%,transparent_50%)] ring-inset ring-[1.5px] ring-idle",
  left: "bg-transparent ring-inset ring-[1.5px] ring-muted-foreground",
};

/** Avatar with a presence dot, as in the demo's roster. The presence itself is written out by the caller. */
export function PresenceAvatar({
  handle,
  presence,
  size = 20,
  ringClass = "ring-sidebar bg-sidebar",
  className,
}: {
  handle: string;
  presence: AgentPresence;
  size?: number;
  ringClass?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0", className)}>
      <Jazzicon handle={handle} size={size} />
      <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 forced-color-adjust-none", ringClass)}>
        <span className={cn("block size-full rounded-full transition-colors duration-500", PRESENCE[presence])} />
      </span>
    </span>
  );
}
