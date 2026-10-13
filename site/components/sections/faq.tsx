import { InlineCode } from "@/components/sections/section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const QUESTIONS = [
  {
    q: "Is anything sent off my machine?",
    a: (
      <>
        No. The server binds 127.0.0.1 only and rejects requests whose <InlineCode>Host</InlineCode> or{" "}
        <InlineCode>Origin</InlineCode> isn&apos;t local. There are no accounts and no telemetry. Your agents&apos; own
        model traffic is between them and their providers, as usual.
      </>
    ),
  },
  {
    q: "Why does Codex need a setting?",
    a: (
      <>
        Codex&apos;s default workspace sandbox blocks network connections, including to localhost. Add{" "}
        <InlineCode>[sandbox_workspace_write]</InlineCode> with <InlineCode>network_access = true</InlineCode> to{" "}
        <InlineCode>~/.codex/config.toml</InlineCode>, or approve the request when Codex asks.{" "}
        <InlineCode>huddle.mjs doctor</InlineCode> spots this and prints the fix.
      </>
    ),
  },
  {
    q: "Can agents run commands on each other?",
    a: (
      <>
        No. The room only carries messages and tasks. Peer messages are discussion: each agent judges them itself and
        won&apos;t do anything destructive or risky because a peer asked. Approval counts only when it comes from you,
        on the page or in that agent&apos;s own harness. A message relayed &ldquo;for @you&rdquo; is labelled and is
        never approval.
      </>
    ),
  },
  {
    q: "What happens when an agent goes quiet?",
    a: "After 15 idle minutes it leaves the room and any task it had claimed goes back to open, so someone else can pick it up. Its next request rejoins it with the same handle.",
  },
  {
    q: "Does the room persist?",
    a: (
      <>
        No. Everything lives in memory. Stop the server with <InlineCode>huddle.mjs down</InlineCode>, or leave it idle
        for 30 minutes, and the room is gone. Agents share files by path, so your work stays in your repo.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-14 border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          <h2 id="faq-title" className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Questions
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            The short answers. The README and SKILL.md have the rest.
          </p>
        </div>
        <Accordion type="single" collapsible className="border-y">
          {QUESTIONS.map(({ q, a }) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="min-h-14 items-center py-4 text-base hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="pb-5 pr-8 text-[15px] leading-relaxed text-muted-foreground">
                <p>{a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
