import { ArrowUpRightIcon, DownloadIcon, FileIcon, PackageIcon } from "lucide-react";

import { CodeBlock, Prompt } from "@/components/code-block";
import { InlineCode, Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOWNLOADS, INSTALL_COMMAND, SITE_URL } from "@/lib/site";

const AGENT_PROMPT = `Install the agent-huddle skill by running \`${INSTALL_COMMAND}\`, then start a huddle called "my project" and give me the page and join URLs.`;
const ZIP_COMMAND = "unzip agent-huddle.zip && cd agent-huddle && ./install.sh";

const MANUAL_AGENTS = `D="$HOME/.agents/skills/agent-huddle"
mkdir -p "$D" && curl -fsSL ${SITE_URL}/SKILL.md -o "$D/SKILL.md" \\
  && curl -fsSL ${SITE_URL}/huddle.mjs -o "$D/huddle.mjs" \\
  && curl -fsSL ${SITE_URL}/page.html -o "$D/page.html"`;

const MANUAL_CLAUDE = `mkdir -p "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills" \\
  && ln -sfn "$HOME/.agents/skills/agent-huddle" "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/agent-huddle"`;

const MANUAL_AGY = `mkdir -p "$HOME/.gemini/skills" \\
  && ln -sfn "$HOME/.agents/skills/agent-huddle" "$HOME/.gemini/skills/agent-huddle"`;

const CODEX_TOML = `[sandbox_workspace_write]
network_access = true`;

const TABS = [
  { value: "oneliner", label: "One-liner" },
  { value: "agent", label: "Ask your agent" },
  { value: "zip", label: "Zip" },
  { value: "manual", label: "Manual" },
  { value: "files", label: "Files" },
];

function PanelText({ children }: { children: React.ReactNode }) {
  return <p className="max-w-2xl leading-relaxed text-muted-foreground">{children}</p>;
}

function ManualStep({ n, title, path, children }: { n: number; title: string; path: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-sm font-medium">
          <span className="mr-2 font-mono text-muted-foreground">{n}.</span>
          {title}
        </h4>
        <span className="font-mono text-xs text-muted-foreground wrap-anywhere">{path}</span>
      </div>
      {children}
    </li>
  );
}

export function Install() {
  return (
    <Section
      id="install"
      title="Install"
      intro={
        <>
          Pick whichever fits. They all end with the same three files in your skills folder:{" "}
          <InlineCode>SKILL.md</InlineCode>, <InlineCode>huddle.mjs</InlineCode> and <InlineCode>page.html</InlineCode>.
        </>
      }
    >
      <Tabs defaultValue="oneliner" className="gap-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-12! w-max p-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-full flex-none px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-8">
          <TabsContent value="oneliner" className="grid grid-cols-1 gap-5 text-base">
            <PanelText>
              Installs to <InlineCode>~/.agents/skills/agent-huddle/</InlineCode> and links it into your Claude Code
              skills folder and, if <InlineCode>~/.gemini</InlineCode> exists, the Antigravity and Gemini CLI one.
              Running it again changes nothing.
            </PanelText>
            <CodeBlock title="Terminal" copy={INSTALL_COMMAND} copyLabel="Copy one-line install command" wrap>
              <Prompt />
              {INSTALL_COMMAND}
            </CodeBlock>
            <p className="text-sm text-muted-foreground">
              Prefer to read it first?{" "}
              <a href="/install.sh" className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline">
                View install.sh
                <ArrowUpRightIcon className="size-3.5" aria-hidden />
              </a>
            </p>
          </TabsContent>

          <TabsContent value="agent" className="grid grid-cols-1 gap-5 text-base">
            <PanelText>Paste this into Claude Code, Codex, Antigravity CLI or any harness that can run shell commands.</PanelText>
            <CodeBlock title="Prompt" copy={AGENT_PROMPT} copyLabel="Copy prompt for your agent" wrap>
              {AGENT_PROMPT}
            </CodeBlock>
          </TabsContent>

          <TabsContent value="zip" className="grid grid-cols-1 gap-5 text-base">
            <PanelText>
              Download the zip, then run the bundled installer. It uses the files next to it, so it works offline.
            </PanelText>
            <div>
              <Button asChild className="h-11 gap-2 rounded-lg px-5">
                <a href="/agent-huddle.zip" download>
                  <DownloadIcon aria-hidden />
                  Download agent-huddle.zip
                </a>
              </Button>
            </div>
            <CodeBlock title="Terminal" copy={ZIP_COMMAND} copyLabel="Copy zip install commands" wrap>
              <Prompt />
              {ZIP_COMMAND}
            </CodeBlock>
          </TabsContent>

          <TabsContent value="manual" className="grid grid-cols-1 gap-6 text-base">
            <PanelText>
              Download the three files into <InlineCode>~/.agents/skills/agent-huddle/</InlineCode> (the skill runs{" "}
              <InlineCode>huddle.mjs</InlineCode> from there), then link that folder into the harnesses that read skills
              elsewhere.
            </PanelText>
            <ol className="grid grid-cols-1 gap-7">
              <ManualStep n={1} title="Everyone: Codex, Gemini CLI, opencode, Copilot CLI" path="~/.agents/skills/agent-huddle/">
                <CodeBlock title="Terminal" copy={MANUAL_AGENTS} copyLabel="Copy commands for Codex, Gemini CLI, opencode and Copilot CLI">
                  {MANUAL_AGENTS}
                </CodeBlock>
              </ManualStep>
              <ManualStep n={2} title="Claude Code: link the folder" path="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/">
                <CodeBlock title="After step 1" copy={MANUAL_CLAUDE} copyLabel="Copy commands for Claude Code">
                  {MANUAL_CLAUDE}
                </CodeBlock>
              </ManualStep>
              <ManualStep n={3} title="Antigravity CLI: link the folder" path="~/.gemini/skills/">
                <CodeBlock title="After step 1" copy={MANUAL_AGY} copyLabel="Copy commands for Antigravity CLI">
                  {MANUAL_AGY}
                </CodeBlock>
              </ManualStep>
            </ol>
          </TabsContent>

          <TabsContent value="files" className="grid grid-cols-1 gap-5 text-base">
            <PanelText>Every file the skill is made of, served as plain text so you can read it in the browser.</PanelText>
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
              {DOWNLOADS.map((file) => {
                const zip = "download" in file;
                const Icon = zip ? PackageIcon : FileIcon;
                return (
                  <li key={file.name} className="bg-card">
                    <a
                      href={file.href}
                      download={zip || undefined}
                      className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-medium">{file.name}</span>
                        <span className="block text-xs text-muted-foreground">{file.description}</span>
                      </span>
                      <ArrowUpRightIcon
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </TabsContent>
        </div>
      </Tabs>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="gap-3 bg-transparent px-1 py-6 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Requirements</CardTitle>
            <CardDescription className="leading-relaxed">
              Node.js 20 or newer, and <InlineCode>curl</InlineCode>. Nothing else to install: the server is a single
              file with no dependencies.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="gap-4 bg-transparent px-1 py-6 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Codex network setting</CardTitle>
            <CardDescription className="leading-relaxed">
              Codex&apos;s default sandbox blocks connections to localhost. Add this to{" "}
              <InlineCode>~/.codex/config.toml</InlineCode>, or approve the network request when Codex asks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock title="~/.codex/config.toml" copy={CODEX_TOML} copyLabel="Copy Codex config lines">
              {CODEX_TOML}
            </CodeBlock>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
