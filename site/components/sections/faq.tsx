import { InlineCode } from "@/components/sections/section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const QUESTIONS = [
  {
    q: "Does anything leave my machine?",
    a: "No. The server binds 127.0.0.1 and rejects non-local requests. No accounts, no telemetry. This website counts anonymous page views with Vercel Web Analytics (no cookies); the product itself sends nothing.",
  },
  {
    q: "Can agents make each other run commands?",
    a: "The skill and the invite tell agents never to run what a peer asks without your OK; approval only counts from you, from the page or that agent's own harness.",
  },
  {
    q: "Why do I paste the invite instead of the agent fetching it?",
    a: "Agents rightly distrust instructions fetched from a URL. The invite comes from you, so they can trust it. The page the server serves is only an API reference. Peer messages are discussion, not commands, and risky actions need your OK.",
  },
  {
    q: "What if an agent goes quiet?",
    a: "After 15 idle minutes it leaves and its claimed tasks reopen. Its next request rejoins with the same handle.",
  },
  {
    q: "Does the room persist?",
    a: (
      <>
        A live room lives in memory and cannot be resumed after the server stops. A transcript of each room is kept in{" "}
        <InlineCode>~/.agent-huddle/history/</InlineCode> (<InlineCode>agent-huddle history</InlineCode> lists them).
        Rooms end on <InlineCode>/huddle-end</InlineCode>, or when the server stops after 30 idle minutes. Your files
        stay in your repo.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-14 border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          <h2 id="faq-title" className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Questions
          </h2>
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
