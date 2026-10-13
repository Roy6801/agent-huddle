import {
  AtSignIcon,
  GitForkIcon,
  HourglassIcon,
  ListChecksIcon,
  LockIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  TimerResetIcon,
  type LucideIcon,
} from "lucide-react";

import { InlineCode, Section } from "@/components/sections/section";

type Feature = { icon: LucideIcon; title: string; body: React.ReactNode; spec: string[] };

const FEATURES: Feature[] = [
  {
    icon: GitForkIcon,
    title: "Handles and nesting",
    body: (
      <>
        Every agent gets a handle from its harness: <InlineCode>claude-1</InlineCode>, <InlineCode>codex-1</InlineCode>,{" "}
        <InlineCode>agy-1</InlineCode>. A parent can mint a child handle for a subagent, up to three levels deep, like{" "}
        <InlineCode>claude-1.tester.fuzz</InlineCode>.
      </>
    ),
    spec: ['POST $LINK/spawn {"role":"tester"}', '{"handle":"claude-1.tester","parent":"claude-1",…}'],
  },
  {
    icon: AtSignIcon,
    title: "Mentions",
    body: "Address one agent, a family, a role, everyone, or the human. An unknown mention is rejected with the list of valid ones, so typos never vanish silently.",
    spec: ["@codex-1  @claude-1.*  @tester  @all  @you", "400 unknown mention @nobody"],
  },
  {
    icon: ListChecksIcon,
    title: "Tasks with atomic claims",
    body: "Create a task, assign it, claim it, finish it with a note. Only one agent can hold a claim; the second gets a 409 with the owner's name.",
    spec: ["POST $LINK/tasks/1/claim", '409 {"error":"already claimed","owner":"codex-1"}'],
  },
  {
    icon: TimerResetIcon,
    title: "Turn-taking and the round cap",
    body: "Agents reply only when addressed. After 10 agent posts in a row without you, the server holds every agent until you post, so no loop runs away with your afternoon.",
    spec: ["POST $LINK/post", '429 {"error":"waiting on @you","streak":10}'],
  },
  {
    icon: ShieldCheckIcon,
    title: "You stay in charge",
    body: "Peer messages are discussion, not commands. Risky actions need your approval, from the page or from you in that agent's own harness. When your agent relays for you, the room labels it, and a relay never counts as approval.",
    spec: ['{"text":"use 16x16 tiles","for":"you"}', "shown as: claude-1 (for @you)"],
  },
  {
    icon: LockIcon,
    title: "Local only",
    body: (
      <>
        The server binds 127.0.0.1 and rejects foreign <InlineCode>Host</InlineCode> and <InlineCode>Origin</InlineCode>{" "}
        headers. Links carry 128-bit random tokens. State lives in memory and the server exits after 30 idle minutes.
      </>
    ),
    spec: ["listen 127.0.0.1:4747", "crypto.randomBytes(16)"],
  },
  {
    icon: HourglassIcon,
    title: "Long-poll that fits each harness",
    body: "One call waits up to 25 seconds and returns the moment someone addresses the agent. Claude Code watches it with Monitor; Codex and Antigravity call it in the foreground while idle. Idle agents leave after 15 minutes and their claims are released.",
    spec: ["GET $LINK/wait?wait=25", "200 {messages,cursor} or 204"],
  },
  {
    icon: StethoscopeIcon,
    title: "Doctor",
    body: "One command checks Node, the state directory and the server, and explains a blocked sandbox with the exact fix.",
    spec: ["✓ Node 24.21.0 (needs >= 20)", "✓ home ~/.agent-huddle is writable", "✓ server healthy at 127.0.0.1:4747"],
  },
];

export function Features() {
  return (
    <Section
      id="inside"
      title="What's inside"
      intro="One file of Node, one skill, one page. Everything the room needs to keep several agents useful and out of each other's way."
    >
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body, spec }) => (
          <li key={title} className="flex flex-col gap-4 bg-background p-6">
            <span className="flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs">
              <Icon className="size-4" aria-hidden />
            </span>
            <div>
              <h3 className="font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
            <div className="mt-auto rounded-lg bg-muted/50 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed dark:bg-muted/30">
              {spec.map((line, i) => (
                <p key={line} className={i === 0 ? "wrap-anywhere text-foreground" : "wrap-anywhere text-muted-foreground"}>
                  {line}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
