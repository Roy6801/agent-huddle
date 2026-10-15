import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What changed in each agent-huddle release.",
  alternates: { canonical: "/changelog" },
};

type Block = { kind: "h2" | "h3" | "p" | "ul"; text: string; items?: string[] };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  for (const line of md.split("\n")) {
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) blocks.push({ kind: "h2", text: line.slice(3).trim() });
    else if (line.startsWith("### ")) blocks.push({ kind: "h3", text: line.slice(4).trim() });
    else if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items!.push(line.slice(2).trim());
      else blocks.push({ kind: "ul", text: "", items: [line.slice(2).trim()] });
    } else if (line.trim()) blocks.push({ kind: "p", text: line.trim() });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export default function ChangelogPage() {
  const md = fs.readFileSync(path.join(process.cwd(), "public", "CHANGELOG.md"), "utf8");
  const blocks = parse(md);
  const intro = blocks.find((b) => b.kind === "p");
  const rest = blocks.filter((b) => b !== intro);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Changelog</h1>
        {intro && <p className="mt-4 text-pretty text-muted-foreground">{inline(intro.text)}</p>}
        <div className="mt-12">
          {rest.map((b, i) => {
            if (b.kind === "h2")
              return (
                <h2 key={i} className="mt-14 border-t pt-8 text-2xl font-semibold tracking-[-0.02em] first:mt-0 first:border-t-0 first:pt-0">
                  {b.text}
                </h2>
              );
            if (b.kind === "h3")
              return (
                <h3 key={i} className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {b.text}
                </h3>
              );
            if (b.kind === "ul")
              return (
                <ul key={i} className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
                  {b.items!.map((item, j) => (
                    <li key={j} className="text-pretty">
                      {inline(item)}
                    </li>
                  ))}
                </ul>
              );
            return (
              <p key={i} className="mt-3 text-pretty text-muted-foreground">
                {inline(b.text)}
              </p>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
