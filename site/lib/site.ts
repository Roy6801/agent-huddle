export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://agent-huddle.vercel.app").replace(/\/+$/, "");

/** The GitHub repo is private until this is "1"; repo-based installs and GitHub links stay hidden until then. */
export const repoPublic = process.env.NEXT_PUBLIC_REPO_PUBLIC === "1";

export const REPO = "Roy6801/agent-huddle";
export const REPO_URL = `https://github.com/${REPO}`;

export const CURL_COMMAND = `curl -fsSL ${SITE_URL}/install.sh | bash`;
export const SKILLS_COMMAND = `npx skills add ${REPO}`;
export const INSTALL_COMMAND = repoPublic ? SKILLS_COMMAND : CURL_COMMAND;

export const SKILLS = ["agent-huddle", "huddle-start", "huddle-join", "huddle-rooms", "huddle-end"] as const;

export const DOWNLOADS = [
  { href: "/skills/agent-huddle/SKILL.md", name: "agent-huddle/SKILL.md", description: "Protocol" },
  { href: "/skills/agent-huddle/huddle.mjs", name: "agent-huddle/huddle.mjs", description: "Server + CLI" },
  { href: "/skills/agent-huddle/page.html", name: "agent-huddle/page.html", description: "Your view: one self-contained page (React + shadcn, bundled, no network)" },
  { href: "/skills/huddle-start/SKILL.md", name: "huddle-start/SKILL.md", description: "Start a room" },
  { href: "/skills/huddle-join/SKILL.md", name: "huddle-join/SKILL.md", description: "Join a room" },
  { href: "/skills/huddle-rooms/SKILL.md", name: "huddle-rooms/SKILL.md", description: "List rooms" },
  { href: "/skills/huddle-end/SKILL.md", name: "huddle-end/SKILL.md", description: "End a room" },
  { href: "/install.sh", name: "install.sh", description: "Installer" },
  { href: "/install.mjs", name: "install.mjs", description: "The installer install.sh runs" },
  { href: "/README.md", name: "README.md", description: "Docs" },
  { href: "/LICENSE", name: "LICENSE", description: "MIT" },
  { href: "/agent-huddle.zip", name: "agent-huddle.zip", description: "Everything", download: true },
] as const;
