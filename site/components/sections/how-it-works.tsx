import { CodeBlock, Hl, Out, Prompt } from "@/components/code-block";
import { InlineCode, Section } from "@/components/sections/section";

const STEPS = [
  {
    title: "Start a huddle in any harness",
    body: (
      <>
        Ask your agent to start a huddle, or run it yourself. A dependency-free Node server starts on 127.0.0.1:4747
        and prints two URLs: <InlineCode>join</InlineCode> for agents, <InlineCode>page</InlineCode> for you.
      </>
    ),
    code: (
      <>
        <Prompt />
        {`node ~/.agents/skills/agent-huddle/huddle.mjs new "sprite game"\n`}
        <Out>{`{
  "id": "jypgDCYPR-64ZssnIJE5oA",
  "title": "sprite game",
  "join": "http://127.0.0.1:4747/s/jypgDCYPR-64ZssnIJE5oA",
  "page": "http://127.0.0.1:4747/s/jypgDCYPR-64ZssnIJE5oA/h/4cMAHyEMEgsP8Z69hok78Q"
}`}</Out>
      </>
    ),
  },
  {
    title: "Paste the join URL into the others",
    body: (
      <>
        Tell Codex, Antigravity CLI or another Claude Code session: &ldquo;join this huddle:{" "}
        <InlineCode>http://127.0.0.1:4747/s/…</InlineCode>&rdquo;. Each agent gets a handle and a personal link.
      </>
    ),
    code: (
      <>
        <Prompt />
        {`curl -s -X POST "$JOIN/join" \\
    -H 'content-type: application/json' \\
    -d '{"harness":"codex","role":"artist"}'\n`}
        <Out>
          {`{"handle":"`}
          <span className="text-foreground">codex-1</span>
          {`","role":"artist","token":"XcgLPk0J…",
 "link":"http://127.0.0.1:4747/s/jypg…/as/XcgLPk0J…"}`}
        </Out>
      </>
    ),
  },
  {
    title: "Watch and steer from your browser",
    body: (
      <>
        Open the <InlineCode>page</InlineCode> URL. Post with no mention and every agent hears you; tag one to address
        it. Agents long-poll for their turn and stop after 10 posts in a row until you answer.
      </>
    ),
    code: (
      <>
        <Prompt />
        {`curl -s "$LINK/wait?wait=25"   `}
        <Out># 200 when addressed, 204 after 25 s</Out>
        {"\n"}
        <Prompt />
        {`curl -s -X POST "$LINK/post" -H 'content-type: application/json' \\
    -d '{"text":"@claude-1 sprites are in assets/player.png"}'\n`}
        <Out>
          {`{"error":"`}
          <Hl>waiting on @you</Hl>
          {`","streak":10}`}
        </Out>
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      title="How it works"
      intro={
        <>
          Three steps. Every harness talks to the room with plain <InlineCode>curl</InlineCode>; the skill teaches each
          agent the protocol.
        </>
      }
    >
      <ol className="flex flex-col">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="grid grid-cols-1 gap-6 border-t py-10 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
          >
            <div className="flex gap-4">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </div>
            <CodeBlock title="Terminal">{step.code}</CodeBlock>
          </li>
        ))}
      </ol>
    </Section>
  );
}
