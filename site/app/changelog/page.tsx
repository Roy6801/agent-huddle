import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What changed in each agent-huddle release.",
  alternates: { canonical: "/changelog" },
};

type Group = { label: string; items: string[] };
type Release = { version: string; date?: string; headline?: string; notes: string[]; groups: Group[] };

function parse(md: string): { intro: string[]; releases: Release[] } {
  const intro: string[] = [];
  const releases: Release[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const release = releases[releases.length - 1];
    if (!line || line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      const m = line.slice(3).match(/^(.+?)(?: \((.+)\))?$/);
      releases.push({ version: m?.[1] ?? line.slice(3), date: m?.[2], notes: [], groups: [] });
    } else if (!release) intro.push(line);
    else if (line.startsWith("### ")) release.groups.push({ label: line.slice(4), items: [] });
    else if (line.startsWith("- ")) {
      if (!release.groups.length) release.groups.push({ label: "", items: [] });
      release.groups[release.groups.length - 1].items.push(line.slice(2));
    } else if (!release.headline) release.headline = line;
    else release.notes.push(line);
  }
  return { intro, releases };
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] break-words">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const groupDot: Record<string, string> = {
  New: "bg-signal",
  Improved: "bg-presence",
  Fixed: "bg-muted-foreground",
};

export default function ChangelogPage() {
  const md = fs.readFileSync(path.join(process.cwd(), "public", "CHANGELOG.md"), "utf8");
  const { intro, releases } = parse(md);
  const first = releases[releases.length - 1]?.date;
  return (
    <>
      <SiteHeader />
      <main id="main" className="relative isolate">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80 bg-signal-glow" />
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <header className="max-w-2xl">
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Changelog</h1>
            {intro.map((p, i) => (
              <p key={i} className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                {inline(p)}
              </p>
            ))}
            {releases.length > 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                {releases.length} releases{first && ` since ${formatDate(first)}`}
              </p>
            )}
          </header>

          <ol className="mt-14 sm:mt-20">
            {releases.map((r, i) => (
              <li
                key={r.version}
                id={`v${r.version}`}
                className="group relative grid scroll-mt-20 pb-14 pl-8 last:pb-0 sm:grid-cols-[9rem_1fr] sm:pb-16 sm:pl-0"
              >
                <span
                  aria-hidden
                  className="absolute top-2 bottom-0 left-[5px] w-px bg-border group-last:hidden sm:left-[calc(9rem+5px)]"
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1 left-0 size-[11px] rounded-full border-2 bg-background sm:left-[9rem]",
                    i === 0 ? "border-signal bg-signal ring-4 ring-signal/20" : "border-muted-foreground/40",
                  )}
                />

                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:sticky sm:top-20 sm:mb-0 sm:flex-col sm:items-end sm:gap-1 sm:self-start sm:pr-8 sm:text-right">
                  <a
                    href={`#v${r.version}`}
                    className="font-mono text-sm font-semibold tracking-tight text-foreground hover:underline underline-offset-4"
                  >
                    {r.version}
                  </a>
                  {r.date && (
                    <time dateTime={r.date} className="text-xs text-muted-foreground">
                      {formatDate(r.date)}
                    </time>
                  )}
                  {i === 0 && (
                    <Badge variant="outline" className="self-center sm:self-end">
                      Latest
                    </Badge>
                  )}
                </div>

                <div className="min-w-0 sm:pl-10">
                  {r.headline && (
                    <h2 className="-mt-0.5 text-pretty text-xl font-semibold leading-snug tracking-[-0.02em] sm:text-2xl">
                      {inline(r.headline)}
                    </h2>
                  )}
                  {r.notes.map((p, j) => (
                    <p key={j} className="mt-2 text-pretty text-sm text-muted-foreground">
                      {inline(p)}
                    </p>
                  ))}
                  {r.groups.map((g, j) => (
                    <section key={j} className="mt-6">
                      {g.label && (
                        <h3 className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          <span aria-hidden className={cn("size-1.5 rounded-full", groupDot[g.label] ?? "bg-border")} />
                          {g.label}
                        </h3>
                      )}
                      <ul className="mt-3 space-y-2.5">
                        {g.items.map((item, k) => (
                          <li
                            key={k}
                            className="relative pl-4 text-pretty text-[0.95rem] leading-relaxed text-foreground/85 before:absolute before:top-[0.7em] before:left-0 before:size-1 before:rounded-full before:bg-muted-foreground/50"
                          >
                            {inline(item)}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
