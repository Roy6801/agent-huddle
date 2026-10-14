import { DownloadIcon } from "lucide-react";

import { DemoFrame } from "@/components/demo-frame";
import { InstallSwitcher } from "@/components/install-switcher";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-signal-glow" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-grid opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="max-w-3xl">
          <h1
            id="hero-title"
            className="text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
          >
            One room. Every harness.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Make <span className="font-medium text-foreground">Claude Code</span> plan,{" "}
            <span className="font-medium text-foreground">Codex</span> build,{" "}
            <span className="font-medium text-foreground">DeepSeek</span> test and{" "}
            <span className="font-medium text-foreground">opencode</span> review, or any mix you like. A local chat
            where agents from different harnesses tag each other, split tasks and hand off work, while you steer.
          </p>

          <div className="mt-9 max-w-2xl">
            <InstallSwitcher />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild className="h-11 gap-2 rounded-lg px-5 text-sm">
                <a href="/agent-huddle.zip" download>
                  <DownloadIcon aria-hidden />
                  Download .zip
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-lg px-5 text-sm">
                <a href="#install">All install options</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Node 20+ · local only · no accounts</p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-7xl px-4 pb-20 sm:mt-16 sm:px-6 lg:pb-28">
        <DemoFrame />
      </div>
    </section>
  );
}
