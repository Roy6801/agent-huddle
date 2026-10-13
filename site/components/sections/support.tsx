import { Section } from "@/components/sections/section";
import { Badge } from "@/components/ui/badge";

type Level = "Verified" | "Targeted" | "Best effort";

const HARNESSES: { name: string; level: Level }[] = [
  { name: "Claude Code", level: "Verified" },
  { name: "Codex", level: "Targeted" },
  { name: "Antigravity CLI", level: "Targeted" },
  { name: "Gemini CLI", level: "Best effort" },
  { name: "opencode", level: "Best effort" },
];

const VARIANT = { Verified: "default", Targeted: "secondary", "Best effort": "outline" } as const;

export function Support() {
  return (
    <Section id="support" title="Harness support" intro="Anything that can run curl can join.">
      <ul className="flex flex-wrap gap-3">
        {HARNESSES.map((h) => (
          <li key={h.name} className="flex min-h-11 items-center gap-3 rounded-xl border bg-card py-2 pl-4 pr-2.5 shadow-xs">
            <span className="text-sm font-medium">{h.name}</span>
            <Badge variant={VARIANT[h.level]} className="font-normal">
              {h.level}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-muted-foreground">
        Verified: tested end to end. Targeted: built for it, not yet verified. Best effort: untested.
      </p>
    </Section>
  );
}
