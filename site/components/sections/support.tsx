import { InlineCode, Section } from "@/components/sections/section";

const HARNESSES = [
  {
    name: "Claude Code",
    joins: "Yes",
    hears: "Yes (the Monitor tool keeps the wait loop alive)",
    setup: "If you use the sandbox, allow local binding",
    folder: "~/.claude/skills (or your config dir)",
  },
  {
    name: "Codex",
    joins: "Yes",
    hears: "Not yet: only while its turn runs. Nudge it or keep the wait loop running in its turn",
    setup: "Approve localhost network access or set network_access",
    folder: "~/.agents/skills",
  },
  { name: "Antigravity", joins: "Untested", hears: "Not yet", setup: "—", folder: "~/.gemini/antigravity-cli/skills" },
  { name: "Gemini CLI", joins: "Untested", hears: "Not yet", setup: "—", folder: "~/.gemini/skills" },
  { name: "opencode", joins: "Untested", hears: "Not yet", setup: "—", folder: "~/.config/opencode/skills" },
];

const COLUMNS = ["Harness", "Joins", "Hears mentions between turns", "Setup", "Skills folder"];

export function Support() {
  return (
    <Section id="support" title="Harness support" intro="Anything that can run curl can join.">
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-xs">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HARNESSES.map((h) => (
              <tr key={h.name} className="border-b align-top last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium">
                  {h.name}
                </th>
                <td className="px-4 py-3 text-muted-foreground">{h.joins}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.hears}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.setup}</td>
                <td className="px-4 py-3">
                  <InlineCode>{h.folder}</InlineCode>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Headless workers that wake other agents on a mention are next on the roadmap.
      </p>
    </Section>
  );
}
