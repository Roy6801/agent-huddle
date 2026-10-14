import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const ROOT = import.meta.dirname;

/**
 * Each build is one single-file page. `vite build` makes the room page: huddle.mjs serves
 * skills/agent-huddle/page.html as is. `vite build --mode demo` makes the site's hero demo: the
 * same app on a scripted room, committed to site/public so the site deploys without building room/.
 */
const TARGETS = {
  page: { entry: "index.html", out: "../skills/agent-huddle/page.html" },
  demo: { entry: "demo.html", out: "../site/public/demo.html" },
};

function emitPage(entry: string, out: string): Plugin {
  return {
    name: "agent-huddle-emit-page",
    apply: "build",
    writeBundle(_, bundle) {
      const html = bundle[entry];
      if (html?.type !== "asset") throw new Error(`${entry} missing from the bundle`);
      const source = String(html.source).replace(
        /^<!doctype html>\n?/i,
        "<!doctype html>\n<!-- generated from room/ by `pnpm build:room`; do not edit -->\n",
      );
      fs.writeFileSync(path.resolve(ROOT, out), source);
    },
  };
}

export default defineConfig(({ mode }) => {
  const target = mode === "demo" ? TARGETS.demo : TARGETS.page;
  return {
    plugins: [react(), tailwindcss(), viteSingleFile(), emitPage(target.entry, target.out)],
    resolve: { alias: { "@": path.resolve(ROOT, "src") } },
    build: {
      outDir: mode === "demo" ? "dist/demo" : "dist",
      rolldownOptions: { input: path.resolve(ROOT, target.entry) },
    },
  };
});
