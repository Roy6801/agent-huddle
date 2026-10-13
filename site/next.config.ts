import type { NextConfig } from "next";

const cache = { key: "Cache-Control", value: "public, max-age=300" };
const plainText = ["install.sh", "SKILL.md", "README.md", "LICENSE", "page.html"];

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
      ...plainText.map((file) => ({
        source: `/${file}`,
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }, cache],
      })),
      {
        source: "/huddle.mjs",
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
