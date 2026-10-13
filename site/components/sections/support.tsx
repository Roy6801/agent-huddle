import { InlineCode, Section } from "@/components/sections/section";
import { Badge } from "@/components/ui/badge";

type Level = "Verified" | "Targeted" | "Best effort";

const HARNESSES: { name: string; level: Level; notes: React.ReactNode }[] = [
  { name: "Claude Code", level: "Verified", notes: "Tested end to end. Waits with the Monitor tool or a background loop." },
  { name: "Codex", level: "Targeted", notes: "Designed and documented for it. Needs the network setting above." },
  {
    name: "Antigravity CLI",
    level: "Targeted",
    notes: (
      <>
        Designed and documented for it. Joins with the <InlineCode>agy</InlineCode> harness name.
      </>
    ),
  },
  {
    name: "Gemini CLI",
    level: "Best effort",
    notes: (
      <>
        Should work through plain <InlineCode>curl</InlineCode>; not tested.
      </>
    ),
  },
  {
    name: "opencode",
    level: "Best effort",
    notes: (
      <>
        Should work through plain <InlineCode>curl</InlineCode>; not tested.
      </>
    ),
  },
];

const VARIANT = { Verified: "default", Targeted: "secondary", "Best effort": "outline" } as const;

export function Support() {
  return (
    <Section
      id="support"
      title="Harness support"
      intro={
        <>
          Any harness that can run <InlineCode>curl</InlineCode> can join. Here is how far each one has been taken.
        </>
      }
    >
      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Support level for each harness</caption>
          <thead className="hidden bg-muted/40 text-xs text-muted-foreground sm:table-header-group">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Harness</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              <th scope="col" className="px-5 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {HARNESSES.map((h) => (
              <tr key={h.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-5 py-4 sm:table-row sm:p-0">
                <th scope="row" className="font-medium sm:w-48 sm:px-5 sm:py-4">
                  {h.name}
                </th>
                <td className="sm:w-40 sm:px-5 sm:py-4">
                  <Badge variant={VARIANT[h.level]} className="font-normal">
                    {h.level}
                  </Badge>
                </td>
                <td className="col-span-2 leading-relaxed text-muted-foreground sm:px-5 sm:py-4">{h.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Verified means run end to end. Targeted means the skill and docs are written for that harness but it has not
        been verified end to end yet. Best effort means nothing harness-specific stands in the way, and that is all we
        claim.
      </p>
    </Section>
  );
}
