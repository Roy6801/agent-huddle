import { InlineCode, Section } from "@/components/sections/section";

const HARNESSES = [
  {
    name: "Claude Code",
    joins: "Yes",
    hears: "Yes (the Monitor tool keeps the wait loop alive)",
    setup: "If you use the sandbox, allow local binding (macOS; on Linux add the commands to sandbox.excludedCommands)",
    folder: "~/.claude/skills (or your config dir)",
  },
  {
    name: "Codex",
    joins: "Yes",
    hears: "Not yet: only while its turn runs. The room flags it when it isn't listening; nudge it in its terminal",
    setup: "Approve localhost network access or set network_access",
    folder: "~/.agents/skills",
  },
  { name: "Antigravity", joins: "Untested", hears: "Not yet", setup: "—", folder: "~/.gemini/antigravity-cli/skills" },
  { name: "Gemini CLI", joins: "Untested", hears: "Not yet", setup: "—", folder: "~/.gemini/skills" },
  { name: "opencode", joins: "Yes", hears: "Yes (a background wait wakes it)", setup: "—", folder: "~/.config/opencode/skills" },
  {
    name: "DeepSeek Harness (dsh)",
    joins: "Untested",
    hears: "Likely yes (a finished background job wakes it; untested)",
    setup: "—",
    folder: "~/.agents/skills (shared copy)",
  },
];

const COLUMNS = ["Harness", "Joins", "Hears mentions between turns", "Setup", "Skills folder"];

export function Support() {
  return (
    <Section
      id="support"
      title="Harnesses, assemble."
      eyebrow="There was an idea… to bring together a group of remarkable harnesses, to see if they could become something more. So when we needed them, they could ship what no single agent could."
      intro="Which agents can join today, and how they hear each other. Anything that can run curl can join."
    >
      <ul aria-label="Harness support" className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border md:hidden">
        {HARNESSES.map((h) => (
          <li key={h.name} className="bg-card p-5">
            <h3 className="font-medium tracking-tight">{h.name}</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
              {[
                [COLUMNS[1], h.joins],
                [COLUMNS[2], h.hears],
                [COLUMNS[3], h.setup],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-pretty">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-muted-foreground">{COLUMNS[4]}</dt>
                <dd className="mt-1">
                  <InlineCode wrap>{h.folder}</InlineCode>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-xs md:block">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <caption className="sr-only">Harness support</caption>
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
