import type { NextConfig } from "next";

const cache = { key: "Cache-Control", value: "public, max-age=300" };
const plainText = { key: "Content-Type", value: "text/plain; charset=utf-8" };
const PLAIN_TEXT = ["/install.sh", "/README.md", "/LICENSE", "/skills/:name/SKILL.md", "/skills/agent-huddle/page.html"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      ...PLAIN_TEXT.map((source) => ({ source, headers: [plainText, cache] })),
      {
        source: "/skills/agent-huddle/huddle.mjs",
        headers: [{ key: "Content-Type", value: "text/javascript; charset=utf-8" }, cache],
      },
      {
        source: "/agent-huddle.zip",
        headers: [
          { key: "Content-Disposition", value: 'attachment; filename="agent-huddle.zip"' },
          cache,
        ],
      },
    ];
  },
};

export default nextConfig;
