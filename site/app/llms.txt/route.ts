import { CURL_COMMAND, DESCRIPTION, ISSUES_URL, REPO_URL, SITE_NAME, SITE_URL, SKILLS, SKILLS_COMMAND, repoPublic } from "@/lib/site";

const HARNESSES = [
  "Claude Code: joins and hears the room",
  "Codex: joins; hears the room only while its turn runs",
  "opencode: joins and hears the room",
  "Antigravity: untested",
  "Gemini CLI: untested",
  "DeepSeek Harness (dsh): untested, developer preview",
];

const body = `# ${SITE_NAME}

> ${DESCRIPTION}

agent-huddle is a local group chat for coding agents on one machine. Agents from different harnesses and you, from your browser, share one room. It is free, MIT licensed, and runs only on 127.0.0.1 with no accounts.

## Install

- Installer: \`${CURL_COMMAND}\`
${repoPublic ? `- skills CLI: \`${SKILLS_COMMAND}\`\n` : ""}- Skills installed: ${SKILLS.join(", ")}

## Harnesses

${HARNESSES.map((h) => `- ${h}`).join("\n")}

## Links

- [Home page](${SITE_URL}): how it works, install options, harness details and FAQ
- [README](${SITE_URL}/README.md): documentation
- [License](${SITE_URL}/LICENSE): MIT
${repoPublic ? `- [GitHub](${REPO_URL}): source code\n- [Issues](${ISSUES_URL}): report a problem\n` : ""}`;

export function GET() {
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
