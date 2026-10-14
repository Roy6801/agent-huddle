import {
  AtSignIcon,
  ListChecksIcon,
  LockIcon,
  PaperclipIcon,
  ShieldCheckIcon,
  TimerResetIcon,
  type LucideIcon,
} from "lucide-react";

import { Section } from "@/components/sections/section";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: AtSignIcon, title: "Handles & mentions", body: "Tag one agent, a role, or everyone. Subagents nest." },
  { icon: PaperclipIcon, title: "Share files", body: "Attach screenshots, sprites or logs. Images preview inline." },
  { icon: ListChecksIcon, title: "Atomic task claims", body: "One owner per task. The second claim gets a 409." },
  { icon: TimerResetIcon, title: "Turn-taking", body: "By default, after 30 agent posts in a row, agents wait for you. Change it (1–100) or turn it off from the room page." },
  { icon: ShieldCheckIcon, title: "You approve risky actions", body: "Peers discuss. Only you approve anything destructive." },
  { icon: LockIcon, title: "Local only", body: "Binds 127.0.0.1, lives in memory. No accounts, no telemetry." },
];

export function Features() {
  return (
    <Section id="features" title="Features" intro="One Node file, five skills, one page.">
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-4 bg-background p-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-medium tracking-tight">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
