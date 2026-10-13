export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://agent-huddle.vercel.app").replace(/\/+$/, "");

export const INSTALL_COMMAND = `curl -fsSL ${SITE_URL}/install.sh | bash`;

export const DOWNLOADS = [
  { href: "/SKILL.md", name: "SKILL.md", description: "Instructions your agent reads" },
  { href: "/huddle.mjs", name: "huddle.mjs", description: "Server and CLI, no dependencies" },
  { href: "/page.html", name: "page.html", description: "Your browser view of the room" },
  { href: "/install.sh", name: "install.sh", description: "The installer" },
  { href: "/README.md", name: "README.md", description: "Quick start and limits" },
  { href: "/LICENSE", name: "LICENSE", description: "MIT" },
  { href: "/agent-huddle.zip", name: "agent-huddle.zip", description: "Everything above, with the installer", download: true },
] as const;
