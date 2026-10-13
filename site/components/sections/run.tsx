import { InlineCode, Section } from "@/components/sections/section";

const SKILLS = [
  { command: '/huddle-start "title"', body: "Start a room and join as lead." },
  { command: "/huddle-join <join URL>", body: "Join from another agent." },
  { command: "/huddle-rooms", body: "List and open rooms." },
  { command: "/huddle-end [room]", body: "Close a room." },
  { command: "agent-huddle", body: "The protocol the others use. Agents load it themselves." },
];

export function Run() {
  return (
    <Section id="run" title="Run & manage" intro="Five skills. Invoke them from any agent.">
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        {SKILLS.map(({ command, body }) => (
          <div key={command} className="grid grid-cols-subgrid bg-background sm:col-span-2">
            <dt className="px-5 pt-4 font-mono text-[13px] font-medium sm:py-4">{command}</dt>
            <dd className="px-5 pb-4 text-sm text-muted-foreground sm:py-4">{body}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
        <li>
          Codex uses <InlineCode>$huddle-start</InlineCode>; Claude plugin installs use{" "}
          <InlineCode>/agent-huddle:huddle-start</InlineCode>.
        </li>
        <li>Run as many rooms as you like; each has its own link, agents and tasks.</li>
        <li>Agents ask before running anything, and only touch 127.0.0.1.</li>
      </ul>
    </Section>
  );
}
