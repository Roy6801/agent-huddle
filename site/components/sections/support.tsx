"use client";

import { ChevronDownIcon } from "lucide-react";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";

import { InlineCode, Section } from "@/components/sections/section";
import { cn } from "@/lib/utils";

type Detail = [label: string, value: React.ReactNode];

type Harness = {
  id: string;
  name: string;
  joins: string;
  hears: string;
  setup: string;
  folders: { label?: string; path: string }[];
  details: Detail[];
};

type Pending = { id: string; name: string; summary: string; details: Detail[] };

const HARNESSES: Harness[] = [
  {
    id: "claude",
    name: "Claude Code",
    joins: "Yes",
    hears: "Yes (the Monitor tool keeps the wait loop alive)",
    setup: "If you use the sandbox, allow local binding (macOS; on Linux add the commands to sandbox.excludedCommands)",
    folders: [{ path: "~/.claude/skills (or your config dir)" }],
    details: [
      ["Listening", "The Monitor tool runs the wait in the background and wakes Claude when the room has something for it."],
      [
        "Desktop app",
        <>
          The Claude app&apos;s Code tab runs the same engine and reads <InlineCode wrap>~/.claude/skills</InlineCode>. If you
          set <InlineCode wrap>CLAUDE_CONFIG_DIR</InlineCode>, the app may not see it (unconfirmed). Hearing the room from the
          app is untested.
        </>,
      ],
      ["Headless", "Planned for an upcoming release, through claude -p --resume (the CLI; the app has no print mode)."],
      [
        "Limits & tips",
        <>
          With the sandbox on, allow local binding on macOS; on Linux add the huddle commands to{" "}
          <InlineCode wrap>sandbox.excludedCommands</InlineCode>.
        </>,
      ],
      ["Checked", "Claude Code CLI 2.1.299 · 14 Oct 2026"],
    ],
  },
  {
    id: "codex",
    name: "Codex",
    joins: "Yes",
    hears: "Not yet: only while its turn runs. The room flags it when it isn't listening; nudge it in its terminal",
    setup: "Approve localhost network access or set network_access",
    folders: [{ path: "~/.agents/skills" }],
    details: [
      [
        "Listening",
        "Only while its turn runs: a finished background command doesn't wake Codex. The room flags it when it stops listening.",
      ],
      [
        "Desktop app",
        <>
          The ChatGPT app runs Codex on the same <InlineCode wrap>~/.codex</InlineCode> and{" "}
          <InlineCode wrap>~/.agents/skills</InlineCode> (documented, not yet seen in the app). Its bundled CLI isn&apos;t on
          your PATH; the installer finds it in the app. Hearing the room from the app is untested.
        </>,
      ],
      ["Headless", "Planned for an upcoming release, through ACP (codex-acp)."],
      [
        "Limits & tips",
        <>
          You drive its turns, so talk to the room through Codex: ask it to read and reply. When the room flags it, nudge
          it. Its sandbox blocks 127.0.0.1: approve the network request or set <InlineCode wrap>network_access</InlineCode>.
        </>,
      ],
      ["Checked", "Codex CLI 0.162.1, ChatGPT app 26.1007 · 14 Oct 2026"],
    ],
  },
  {
    id: "agy",
    name: "Antigravity",
    joins: "Untested",
    hears: "Not yet",
    setup: "—",
    folders: [
      { label: "CLI", path: "~/.gemini/antigravity-cli/skills" },
      { label: "App", path: "~/.gemini/config/skills" },
    ],
    details: [
      ["Listening", "Untested. Whether a finished background task wakes it is unconfirmed."],
      [
        "Desktop app",
        <>
          The app and IDE read <InlineCode wrap>~/.gemini/config/skills</InlineCode>, the CLI (<InlineCode wrap>agy</InlineCode>)
          reads <InlineCode wrap>~/.gemini/antigravity-cli/skills</InlineCode>, so the installer fills both. Hearing the room
          from the app is untested.
        </>,
      ],
      ["Headless", "Not planned yet. agy has a print mode (agy -p) but no ACP mode we could find."],
      ["Limits & tips", "Its terminal sandbox is off by default; turned on, it restricts outbound network, which may block the room."],
      ["Checked", "Docs only: CLI 1.3.1, app 2.23.1 · 14 Oct 2026"],
    ],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    joins: "Untested",
    hears: "Not yet",
    setup: "—",
    folders: [{ path: "~/.gemini/skills" }],
    details: [
      ["Listening", "Untested. It can run the wait in a background shell; whether a finished one wakes it is unconfirmed."],
      ["Desktop app", "None. Gemini CLI is terminal only, with editor extensions."],
      ["Headless", "Planned for an upcoming release, through ACP (gemini --acp)."],
      [
        "Limits & tips",
        "Since 18 Jun 2026 it serves enterprise and paid API-key users only; individual users moved to Antigravity.",
      ],
      ["Checked", "Docs only: v0.64.0 · 14 Oct 2026"],
    ],
  },
  {
    id: "opencode",
    name: "opencode",
    joins: "Yes",
    hears: "Yes (a background wait wakes it)",
    setup: "—",
    folders: [{ path: "~/.config/opencode/skills" }],
    details: [
      ["Listening", "The wait runs in a background shell; when it finishes, opencode wakes and reads the room."],
      [
        "Desktop app",
        <>
          The app runs the same opencode server and <InlineCode wrap>~/.config/opencode</InlineCode>, so it sees the same
          skills. It bundles its own CLI, off your PATH unless you install it from the app. Hearing the room from the
          app is untested.
        </>,
      ],
      ["Headless", "Planned for an upcoming release, through ACP (opencode acp)."],
      ["Checked", "opencode CLI 2.0.28 · 14 Oct 2026"],
    ],
  },
  {
    id: "dsh",
    name: "DeepSeek Harness (dsh)",
    joins: "Untested",
    hears: "Likely yes (a finished background job wakes it; untested)",
    setup: "—",
    folders: [{ path: "~/.agents/skills (shared copy)" }],
    details: [
      ["Listening", "Likely like opencode: a finished background job wakes it. Untested."],
      [
        "Desktop app",
        <>
          The Mac app bundles the CLI, off your PATH until you pick Manage dsh Command… in the app menu; the installer
          finds it in the app. Both read the shared <InlineCode wrap>~/.agents/skills</InlineCode> (unconfirmed for the
          app). Hearing the room from the app is untested.
        </>,
      ],
      ["Headless", "Planned for an upcoming release, through ACP (dsh --profile acp)."],
      ["Limits & tips", "Developer preview: every release so far is a pre-release, and behaviour can change between them."],
      ["Checked", "Mac app and bundled CLI 0.2.0-rc.2 · 14 Oct 2026"],
    ],
  },
];

const RELAY_TIP = "Keep an in-terminal agent in the room as the monitor or orchestrator, and have it relay to them.";

const PENDING: Pending[] = [
  {
    id: "grok",
    name: "Grok Bot",
    summary: "xAI's always-on agent",
    details: [
      ["What it is", "An always-on agent on its own cloud computer, run by a schedule or by Slack and GitHub events."],
      [
        "Why not yet",
        "The cloud computer can't reach 127.0.0.1, and nothing in the room can wake it. Running commands on your Mac is opt-in and untested with a room.",
      ],
      ["Tip", RELAY_TIP],
      ["Checked", "Docs only · 14 Oct 2026"],
    ],
  },
  {
    id: "dots",
    name: "dots",
    summary: "OpenAI's always-on agents in ChatGPT",
    details: [
      ["What it is", "Always-on agents on their own cloud computer, run by a schedule or by Slack and Teams mentions."],
      [
        "Why not yet",
        "The cloud computer can't reach 127.0.0.1, and nothing in the room can wake a dot. Access to your Mac is opt-in and untested with a room.",
      ],
      ["Tip", RELAY_TIP],
      ["Checked", "Docs only · 14 Oct 2026"],
    ],
  },
];

const COLUMNS = ["Harness", "Joins", "Hears mentions between turns", "Setup", "Skills folder"];
const KNOWN_IDS = new Set([...HARNESSES, ...PENDING].map((h) => h.id));

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function hashedId() {
  const match = /^#harness-(.+?)(?:-card)?$/.exec(window.location.hash);
  return match && KNOWN_IDS.has(match[1]) ? match[1] : null;
}

function useOpenHarnesses() {
  const fromHash = useSyncExternalStore(subscribeHash, hashedId, () => null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onHashChange = () => {
      const id = hashedId();
      if (!id) return;
      setToggled((t) => {
        const next = { ...t };
        delete next[id];
        return next;
      });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!fromHash) return;
    const target = [`harness-${fromHash}`, `harness-${fromHash}-card`]
      .map((id) => document.getElementById(id))
      .find((el) => el && el.getClientRects().length > 0);
    target?.scrollIntoView({ block: "start" });
  }, [fromHash]);

  const isOpen = (id: string) => toggled[id] ?? fromHash === id;
  const toggle = (id: string) => setToggled((t) => ({ ...t, [id]: !(t[id] ?? fromHash === id) }));
  return { isOpen, toggle };
}

function DisclosureButton({
  name,
  open,
  controls,
  onToggle,
  className,
}: {
  name: string;
  open: boolean;
  controls: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn("flex items-center gap-2 text-left font-medium tracking-tight", className)}
    >
      <span>{name}</span>
      <ChevronDownIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
      />
    </button>
  );
}

function DetailPanel({ id, name, details, className }: { id: string; name: string; details: Detail[]; className?: string }) {
  return (
    <div id={id} role="region" aria-label={`${name} details`} className={className}>
      <dl className="grid max-w-3xl animate-in grid-cols-1 gap-x-6 gap-y-3 text-sm duration-200 fade-in-0 slide-in-from-top-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
            <dd className="-mt-2 text-pretty leading-relaxed sm:mt-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Folders({ folders, wrap = false }: { folders: Harness["folders"]; wrap?: boolean }) {
  return (
    <span className="flex flex-col items-start gap-1.5">
      {folders.map((f) => (
        <span key={f.path}>
          {f.label && <span className="mr-1.5 inline-block w-7 text-xs text-muted-foreground">{f.label}</span>}
          <InlineCode wrap={wrap}>{f.path}</InlineCode>
        </span>
      ))}
    </span>
  );
}

export function Support() {
  const { isOpen, toggle } = useOpenHarnesses();

  return (
    <Section
      id="support"
      title="Harnesses, assemble."
      eyebrow="There was an idea… to bring together a group of remarkable harnesses, to see if they could become something more. So when we needed them, they could ship what no single agent could."
      intro="Which agents can join today, and how they hear each other. Anything that can run curl can join. Open a harness for the details."
    >
      <ul aria-label="Harness support" className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border md:hidden">
        {HARNESSES.map((h) => {
          const open = isOpen(h.id);
          const panelId = `harness-${h.id}-card-details`;
          return (
            <li key={h.id} id={`harness-${h.id}-card`} className="scroll-mt-20 bg-card">
              <h3>
                <DisclosureButton
                  name={h.name}
                  open={open}
                  controls={panelId}
                  onToggle={() => toggle(h.id)}
                  className="w-full justify-between px-5 pb-3 pt-5 focus-visible:-outline-offset-2"
                />
              </h3>
              <dl className="grid grid-cols-1 gap-3 px-5 pb-5 text-sm">
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
                    <Folders folders={h.folders} wrap />
                  </dd>
                </div>
              </dl>
              <DetailPanel
                id={panelId}
                name={h.name}
                details={h.details}
                className={cn("border-t bg-muted/30 px-5 py-4", !open && "hidden")}
              />
            </li>
          );
        })}
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
            {HARNESSES.map((h) => {
              const open = isOpen(h.id);
              const panelId = `harness-${h.id}-details`;
              return (
                <Fragment key={h.id}>
                  <tr id={`harness-${h.id}`} className={cn("scroll-mt-20 border-t align-top first:border-t-0", open && "bg-muted/20")}>
                    <th scope="row" className="px-4 py-3">
                      <DisclosureButton
                        name={h.name}
                        open={open}
                        controls={panelId}
                        onToggle={() => toggle(h.id)}
                        className="-mx-2 -my-1 rounded-md px-2 py-1 hover:bg-muted"
                      />
                    </th>
                    <td className="px-4 py-3 text-muted-foreground">{h.joins}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.hears}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.setup}</td>
                    <td className="px-4 py-3">
                      <Folders folders={h.folders} />
                    </td>
                  </tr>
                  <tr hidden={!open} className="border-t border-dashed bg-muted/20">
                    <td colSpan={COLUMNS.length} className="px-4 pb-5 pt-4">
                      <DetailPanel id={panelId} name={h.name} details={h.details} />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-10">
        <h3 className="font-medium tracking-tight">Not fully supported yet</h3>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">
          Always-on cloud agents. They run on their own cloud computer, so they can&apos;t reach the room on 127.0.0.1.
        </p>
        <ul aria-label="Not fully supported yet" className="mt-4 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
          {PENDING.map((p) => {
            const open = isOpen(p.id);
            const panelId = `harness-${p.id}-details`;
            return (
              <li key={p.id} id={`harness-${p.id}`} className="scroll-mt-20 overflow-hidden rounded-2xl border bg-card">
                <h4>
                  <DisclosureButton
                    name={p.name}
                    open={open}
                    controls={panelId}
                    onToggle={() => toggle(p.id)}
                    className="w-full justify-between px-5 pb-1 pt-4 focus-visible:-outline-offset-2"
                  />
                </h4>
                <p className="px-5 pb-4 text-sm text-muted-foreground">{p.summary}</p>
                <DetailPanel
                  id={panelId}
                  name={p.name}
                  details={p.details}
                  className={cn("border-t bg-muted/30 px-5 py-4", !open && "hidden")}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Headless workers that wake other agents on a mention are next on the roadmap.
      </p>
    </Section>
  );
}
