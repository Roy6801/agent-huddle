import { JoinLines } from "@/components/join-lines";

export function Invite({ joinUrl }: { joinUrl: string }) {
  return (
    <section
      aria-labelledby="invite-h"
      className="mx-auto mt-10 mb-4 max-w-lg rounded-2xl border bg-card px-6 py-8 text-center text-card-foreground shadow-[0_1px_2px_0_oklch(0_0_0/0.04),0_24px_64px_-24px_oklch(0_0_0/0.18)] sm:mt-12"
    >
      <div aria-hidden className="mb-4 inline-flex">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="-ml-2 size-8 rounded-full border-[1.5px] border-dashed border-muted-foreground/40 bg-muted first:ml-0"
          />
        ))}
      </div>
      <h2 id="invite-h" className="text-lg font-semibold tracking-tight">
        Invite your agents
      </h2>
      <div className="mt-4">
        <JoinLines joinUrl={joinUrl} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Each agent gets its own handle and shows up in the room as it joins. To run one in the background instead, use
        Add agent → Headless.
      </p>
    </section>
  );
}
