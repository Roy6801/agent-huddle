import { ArrowUpRightIcon, DownloadIcon } from "lucide-react";
import { Fragment } from "react";

import { CodeBlock, Hl, Out, Prompt } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { InlineCode, Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURL_COMMAND, DOWNLOADS, ISSUES_URL, MAINTAINER, REPO, REPO_URL, SITE_URL, SKILLS, SKILLS_COMMAND, repoPublic } from "@/lib/site";

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
# Link them for Claude Code and Antigravity
for d in "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills" "$HOME/.gemini/antigravity-cli/skills"; do
  mkdir -p "$d" && for s in ${SKILLS.join(" ")}; do ln -sfn "$S/$s" "$d/$s"; done
done`;

const PICK_ROWS = [
  { on: true, label: "Codex            ~/.agents/skills (shared copy, always installed)" },
  { on: true, label: "Claude Code      ~/.claude/skills" },
  { on: false, label: "Antigravity CLI  ~/.gemini/antigravity-cli/skills" },
  { on: false, label: "Antigravity app  ~/.gemini/config/skills" },
  { on: false, label: "Gemini CLI       ~/.gemini/skills" },
  { on: true, label: "opencode         ~/.config/opencode/skills" },
];

const PLAN = [
  "copy 5 skills → ~/.agents/skills (shared copy)",
  "link 5 skills → ~/.claude/skills",
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
          <TabsList className="h-12! w-max p-1 pointer-coarse:h-13!">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-full flex-none px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

          <TabsContent value="curl" className="grid grid-cols-1 gap-4">
            <CodeBlock title="Terminal" copy={CURL_COMMAND} copyLabel="Copy curl install command" wrap>
              <Prompt />
              {CURL_COMMAND}
            </CodeBlock>
            <CodeBlock title="What you'll see">
              <Hl>◆</Hl>
              {"  Install the skills for\n"}
              {PICK_ROWS.map((row) => (
                <Fragment key={row.label}>
                  <Out>{"│  "}</Out>
                  {row.on ? <Hl>◼</Hl> : "◻"}
                  {` ${row.label}`}
                  {"\n"}
                </Fragment>
              ))}
              <Out>{"│  ↑/↓ to navigate • Space: select • Enter: confirm\n│\n◇  Folders\n│  "}</Out>
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
              Nothing is written until you confirm the plan; choices are saved and reused when you rerun it to update.
              Flags: <InlineCode>--yes</InlineCode>, <InlineCode>--dir agent[=path]</InlineCode>,{" "}
              <InlineCode>--dry-run</InlineCode>, <InlineCode>--uninstall</InlineCode>.{" "}
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
                  Every agent, no prompts: <InlineCode wrap>{SKILLS_ALL}</InlineCode>
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
      </Tabs>

      <ul className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
        <li>
          <span className="font-medium text-foreground">Node 20+</span> (installer: 20.12+)
        </li>
        <li className="flex min-w-0 items-center gap-1">
          <span className="min-w-0">
            <span className="font-medium text-foreground">Codex:</span> add{" "}
            <InlineCode wrap>[sandbox_workspace_write] network_access = true</InlineCode>{" "}
            to <InlineCode>~/.codex/config.toml</InlineCode>
          </span>
          <CopyButton text={CODEX_TOML} label="Copy Codex config lines" />
        </li>
        <li>
          <span className="font-medium text-foreground">Stuck?</span> <InlineCode>agent-huddle doctor</InlineCode> lists
          detected agents and missing skills; <InlineCode>agent-huddle upgrade</InlineCode> updates
        </li>
        <li>
          <a href="/LICENSE" className="font-medium text-foreground underline underline-offset-4">
            MIT license
          </a>
          {repoPublic && (
            <>
              {" · "}
              <a href={REPO_URL} className="font-medium text-foreground underline underline-offset-4">
                GitHub
              </a>
              {" · "}
              <a href={ISSUES_URL} className="font-medium text-foreground underline underline-offset-4">
                Report an issue
              </a>
              {` · Maintained by ${MAINTAINER}`}
            </>
          )}
        </li>
      </ul>
    </Section>
  );
}
