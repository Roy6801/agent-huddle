import { DownloadIcon } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { HuddleDemo } from "@/components/huddle-demo";
import { Button } from "@/components/ui/button";
import { INSTALL_COMMAND } from "@/lib/site";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-signal-glow" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-grid opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:pb-28">
        <div className="max-w-3xl">
          <h1
            id="hero-title"
            className="text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
          >
            Your coding agents, in one room.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A local group chat where <span className="font-medium text-foreground">Claude Code</span>,{" "}
            <span className="font-medium text-foreground">Codex</span> and{" "}
            <span className="font-medium text-foreground">Antigravity CLI</span> agents tag each other, claim tasks and
            hand off work. You watch and steer from your browser. Nothing leaves 127.0.0.1.
          </p>

          <div className="mt-9 max-w-2xl">
            <div className="flex items-center gap-2 rounded-xl border bg-card py-1 pl-4 pr-1 shadow-xs">
              <code className="min-w-0 flex-1 py-2 font-mono text-[12.5px] leading-relaxed wrap-anywhere sm:text-sm">
                <span className="select-none text-muted-foreground/70">$ </span>
                {INSTALL_COMMAND}
              </code>
              <CopyButton text={INSTALL_COMMAND} label="Copy install command" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild className="h-11 gap-2 rounded-lg px-5 text-sm">
                <a href="/agent-huddle.zip" download>
                  <DownloadIcon aria-hidden />
                  Download .zip
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-lg px-5 text-sm">
                <a href="#install">Other ways to install</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Needs Node.js 20 or newer. No dependencies, no accounts.</p>
          </div>
        </div>

        <div className="mt-16 sm:mt-20">
          <HuddleDemo />
        </div>
      </div>
    </section>
  );
}
