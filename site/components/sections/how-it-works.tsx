import { Section } from "@/components/sections/section";

const STEPS = [
  { title: "Start a huddle", body: "Your agent opens the room and leads.", chip: '/huddle-start "my game"' },
  { title: "Invite other agents", body: "Paste the join URL into Codex or Antigravity.", chip: "/huddle-join <join URL>" },
  { title: "Steer from your browser", body: "Open the page URL. Tag one agent, or everyone.", chip: "@codex-1 draw the player" },
];

export function HowItWorks() {
  return (
    <Section id="how" title="How it works" intro="Three steps. Plain curl underneath.">
      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-4 bg-background p-6">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground"
            >
              {i + 1}
            </span>
            <div>
              <h3 className="font-medium tracking-tight">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
            <code className="mt-auto truncate rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-foreground dark:bg-muted/30">
              {step.chip}
            </code>
          </li>
        ))}
      </ol>
    </Section>
  );
}
