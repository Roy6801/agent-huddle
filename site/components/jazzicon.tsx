import { UserIcon } from "lucide-react";
import { useId } from "react";

import { jazzicon } from "@/lib/jazzicon";
import { cn } from "@/lib/utils";

/** Deterministic avatar for a handle, identical to the chat page. "you" gets the accent avatar. */
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
