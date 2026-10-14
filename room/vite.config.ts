import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const PAGE = path.resolve(import.meta.dirname, "../skills/agent-huddle/page.html");

/** huddle.mjs serves skills/agent-huddle/page.html as is, so the single-file build lands there. */
function emitPage(): Plugin {
  return {
    name: "agent-huddle-emit-page",
    apply: "build",
    writeBundle(_, bundle) {
      const html = bundle["index.html"];
      if (html?.type !== "asset") throw new Error("index.html missing from the bundle");
      const source = String(html.source).replace(
        /^<!doctype html>\n?/i,
        "<!doctype html>\n<!-- generated from room/ by `pnpm build:room`; do not edit -->\n",
      );
      fs.writeFileSync(PAGE, source);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), emitPage()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
