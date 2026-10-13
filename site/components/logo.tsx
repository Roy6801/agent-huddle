import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" className="fill-foreground" />
      <circle cx="8.25" cy="8.25" r="2.4" className="fill-background" />
      <circle cx="15.75" cy="8.25" r="2.4" className="fill-background" />
      <circle cx="8.25" cy="15.75" r="2.4" className="fill-background" />
      <circle cx="15.75" cy="15.75" r="2.4" className="fill-signal" />
    </svg>
  );
}
