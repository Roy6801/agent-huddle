import { ArrowUpRightIcon, DownloadIcon } from "lucide-react";
import { Fragment } from "react";

import { CodeBlock, Hl, Out, Prompt } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { InlineCode, Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURL_COMMAND, DOWNLOADS, REPO, SITE_URL, SKILLS, SKILLS_COMMAND, repoPublic } from "@/lib/site";

const SKILLS_ALL = `${SKILLS_COMMAND} --skill '*' -g -a claude-code -a codex -a gemini-cli -a antigravity-cli -a opencode -y`;
const PLUGIN = `/plugin marketplace add ${REPO}\n/plugin install agent-huddle@agent-huddle`;
const GEMINI = `gemini skills install https://github.com/${REPO}.git --path skills --consent`;
const ZIP_COMMAND = "unzip agent-huddle.zip && cd agent-huddle && ./install.sh";

const MANUAL = `# Skills live in ~/.agents/skills (Codex, Gemini CLI and opencode read it)
S="$HOME/.agents/skills"; B="${SITE_URL}/skills"
for f in SKILL.md huddle.mjs page.html; do
  curl -fsSL --create-dirs "$B/agent-huddle/$f" -o "$S/agent-huddle/$f"
done
for v in ${SKILLS.slice(1).join(" ")}; do
  curl -fsSL --create-dirs "$B/$v/SKILL.md" -o "$S/$v/SKILL.md"
done
chmod +x "$S/agent-huddle/huddle.mjs"
# Link them for Claude Code and Antigravity CLI
for d in "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills" "$HOME/.gemini/skills"; do
  mkdir -p "$d" && for s in ${SKILLS.join(" ")}; do ln -sfn "$S/$s" "$d/$s"; done
done`;

const PICK_ROWS = [
  { on: true, label: "Claude Code  ~/.claude/skills" },
  { on: false, label: "Claude Code  ~/.claude-old/skills", hint: "(no sessions here)" },
  { on: true, label: "Claude Code  ~/.claude-work/skills" },
  { on: false, label: "Antigravity  ~/.gemini/antigravity-cli/skills" },
  { on: false, label: "Gemini CLI   ~/.gemini/skills" },
  { on: true, label: "opencode     ~/.config/opencode/skills" },
];

const PLAN = [
  "copy 5 skills → ~/.agents/skills (shared copy)",
  "link 5 skills → ~/.claude/skills",
  "link 5 skills → ~/.claude-work/skills",
  "link 5 skills → ~/.config/opencode/skills (create folder)",
];

const CODEX_TOML = `[sandbox_workspace_write]
network_access = true`;

const TABS = [
  { value: "curl", label: "Installer" },
  { value: "skills", label: "skills CLI" },
  { value: "plugin", label: "Claude plugin" },
  { value: "gemini", label: "Gemini CLI" },
  { value: "zip", label: "Zip" },
  { value: "manual", label: "Manual" },
  { value: "files", label: "Files" },
];

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Pending() {
  return <Note>Available once the GitHub repo is public.</Note>;
}

export function Install() {
  return (
    <Section id="install" title="Install" intro="Every option installs the same five skills. The installer is interactive; the others are alternatives.">
      <Tabs defaultValue={repoPublic ? "skills" : "curl"} className="gap-5">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-12! w-max p-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-full flex-none px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
          <TabsContent value="curl" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Terminal" copy={CURL_COMMAND} copyLabel="Copy curl install command" wrap>
              <Prompt />
              {CURL_COMMAND}
            </CodeBlock>
            <CodeBlock title="Pick agents">
              <Hl>◆</Hl>
              {"  Install the skills for\n"}
              {PICK_ROWS.map((row) => (
                <Fragment key={row.label}>
                  <Out>{"│  "}</Out>
                  {row.on ? <Hl>◼</Hl> : "◻"}
                  {` ${row.label}`}
                  {row.hint && <Out> {row.hint}</Out>}
                  {"\n"}
                </Fragment>
              ))}
              <Out>{"│  ↑/↓ to navigate • Space: select • Enter: confirm\n└"}</Out>
            </CodeBlock>
            <CodeBlock title="Review the plan">
              <Out>{"◇  Folders\n│  "}</Out>
              {"Continue\n"}
              <Out>{"│\n◇  Plan\n"}</Out>
              {PLAN.map((line) => (
                <Fragment key={line}>
                  <Out>│  </Out>
                  {line}
                  {"\n"}
                </Fragment>
              ))}
              <Out>{"│\n"}</Out>
              <Hl>◆</Hl>
              {"  Proceed?\n"}
              <Out>{"│  "}</Out>
              <Hl>●</Hl>
              {" Yes / ○ No\n"}
              <Out>└</Out>
            </CodeBlock>
            <Note>
              Claude Code config folders are preselected only when they hold sessions. Then{" "}
              <span className="font-medium text-foreground">Folders</span> lets you continue, edit a folder or add a
              custom one, and nothing is written until you confirm the plan. Choices are saved to{" "}
              <InlineCode>~/.agent-huddle/install.json</InlineCode> and reused when you rerun it to update.
            </Note>
            <Note>
              Flags: <InlineCode>--yes</InlineCode> skips prompts, <InlineCode>--dir agent[=path]</InlineCode> picks a
              target (repeatable), <InlineCode>--dry-run</InlineCode> prints the plan,{" "}
              <InlineCode>--uninstall</InlineCode> removes everything it installed (add <InlineCode>--yes</InlineCode>{" "}
              outside a terminal). Run by an AI agent or without a terminal, it prints the plan and installs nothing
              until you rerun with <InlineCode>--yes</InlineCode> or <InlineCode>--dir</InlineCode>.{" "}
              <a
                href="/install.sh"
                className="inline-flex min-h-11 items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline"
              >
                Read install.sh
                <ArrowUpRightIcon className="size-3.5" aria-hidden />
              </a>
            </Note>
          </TabsContent>

          <TabsContent value="skills" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Terminal" copy={SKILLS_COMMAND} copyLabel="Copy skills CLI install command" wrap>
              <Prompt />
              {SKILLS_COMMAND}
            </CodeBlock>
            {repoPublic ? (
              <div className="flex min-w-0 items-center gap-1">
                <p className="min-w-0 text-sm text-muted-foreground">
                  Every agent, no prompts: <InlineCode><span className="wrap-anywhere">{SKILLS_ALL}</span></InlineCode>
                </p>
                <CopyButton text={SKILLS_ALL} label="Copy non-interactive install for every agent" />
              </div>
            ) : (
              <Pending />
            )}
          </TabsContent>

          <TabsContent value="plugin" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Claude Code" copy={PLUGIN} copyLabel="Copy Claude plugin commands" wrap>
              {PLUGIN}
            </CodeBlock>
            {repoPublic ? <Note>Skills are namespaced, like /agent-huddle:huddle-start.</Note> : <Pending />}
          </TabsContent>

          <TabsContent value="gemini" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Terminal" copy={GEMINI} copyLabel="Copy Gemini CLI install command" wrap>
              <Prompt />
              {GEMINI}
            </CodeBlock>
            {repoPublic ? <Note>Installs all five skills for Gemini CLI.</Note> : <Pending />}
          </TabsContent>

          <TabsContent value="zip" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Terminal" copy={ZIP_COMMAND} copyLabel="Copy zip install commands" wrap>
              <Prompt />
              {ZIP_COMMAND}
            </CodeBlock>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button asChild className="h-11 gap-2 rounded-lg px-5">
                <a href="/agent-huddle.zip" download>
                  <DownloadIcon aria-hidden />
                  Download .zip
                </a>
              </Button>
              <Note>Works offline with the bundled files.</Note>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Terminal" copy={MANUAL} copyLabel="Copy manual install commands">
              {MANUAL.split("\n").map((line, i) => (
                <span key={i}>
                  {line.startsWith("#") ? <Out>{line}</Out> : line}
                  {"\n"}
                </span>
              ))}
            </CodeBlock>
          </TabsContent>

          <TabsContent value="files">
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {DOWNLOADS.map((file) => (
                <li key={file.href} className="bg-card">
                  <a
                    href={file.href}
                    download={"download" in file || undefined}
                    className="flex min-h-14 flex-col justify-center px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <span className="truncate font-mono text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{file.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </TabsContent>
        </div>
      </Tabs>

      <ul className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:gap-6">
        <li>
          <span className="font-medium text-foreground">Node 20+</span> (installer: 20.12+)
        </li>
        <li className="flex min-w-0 items-center gap-1">
          <span className="min-w-0">
            <span className="font-medium text-foreground">Codex:</span> add{" "}
            <InlineCode>
              <span className="wrap-anywhere">[sandbox_workspace_write] network_access = true</span>
            </InlineCode>{" "}
            to <InlineCode>~/.codex/config.toml</InlineCode>
          </span>
          <CopyButton text={CODEX_TOML} label="Copy Codex config lines" />
        </li>
        <li>
          <span className="font-medium text-foreground">Stuck?</span> <InlineCode>huddle.mjs doctor</InlineCode> lists
          detected agents and missing skills
        </li>
      </ul>
    </Section>
  );
}
