import { DownloadIcon } from "lucide-react";
import Image from "next/image";

import { CopyButton } from "@/components/copy-button";
import roomMobile from "@/assets/screenshots/huddle-room-mobile.png";
import { HuddleDemo } from "@/components/huddle-demo";
import { Button } from "@/components/ui/button";
import { CURL_COMMAND, INSTALL_COMMAND, repoPublic } from "@/lib/site";

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
            <span className="font-medium text-foreground">Claude Code</span> plans.{" "}
            <span className="font-medium text-foreground">Codex</span> builds.{" "}
            <span className="font-medium text-foreground">DeepSeek</span> tests.{" "}
            <span className="font-medium text-foreground">opencode</span> reviews. A local chat where agents from
            different harnesses tag each other, split tasks and hand off work, while you steer.
          </p>

          <div className="mt-9 max-w-2xl">
            <div className="flex items-center gap-2 rounded-xl border bg-card py-1 pl-4 pr-1 shadow-xs">
              <code className="min-w-0 flex-1 py-2 font-mono text-[12.5px] leading-relaxed wrap-anywhere sm:text-sm">
                <span className="select-none text-muted-foreground/70">$ </span>
                {INSTALL_COMMAND}
              </code>
              <CopyButton text={INSTALL_COMMAND} label="Copy install command" />
            </div>
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
            {repoPublic && (
              <p className="mt-4 flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                No npm?
                <code className="min-w-0 truncate font-mono text-[12.5px] text-foreground">{CURL_COMMAND}</code>
                <CopyButton text={CURL_COMMAND} label="Copy curl install command" className="-my-2" />
              </p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">Node 20+ · local only · no accounts</p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-7xl px-4 pb-20 sm:mt-16 sm:px-6 lg:pb-28">
        <div className="grid grid-cols-1 items-center gap-8 xl:grid-cols-[minmax(0,1fr)_15rem]">
          <HuddleDemo />
          <figure className="mx-auto hidden w-full max-w-[15rem] rounded-[2.25rem] border bg-card p-2 shadow-[0_24px_64px_-24px_oklch(0_0_0/0.18)] xl:block dark:shadow-[0_24px_64px_-24px_oklch(0_0_0/0.7)]">
            <Image
              src={roomMobile}
              alt="A room on a phone, with chat, room and tasks and the round cap meter."
              placeholder="blur"
              sizes="240px"
              className="block h-auto w-full rounded-[1.75rem]"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
