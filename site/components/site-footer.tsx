import Link from "next/link";
import { Suspense } from "react";

import { CurrentYear } from "@/components/current-year";
import { GithubIcon } from "@/components/github-icon";
import { LogoMark } from "@/components/logo";
import { ISSUES_URL, MAINTAINER, REPO_URL, repoPublic } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:gap-3 md:py-8">
        <div className="flex items-center gap-3 md:contents">
          <LogoMark className="size-6 shrink-0" />
          <span className="font-semibold text-foreground md:hidden">agent-huddle</span>
        </div>
        <p className="min-w-0 text-xs leading-relaxed max-md:order-3 md:flex-1 md:text-sm md:leading-normal">
          ©{" "}
          <Suspense>
            <CurrentYear />
          </Suspense>{" "}
          agent-huddle · <a href="/LICENSE" className="underline underline-offset-4 hover:text-foreground">MIT license</a>, runs only on 127.0.0.1.{repoPublic && ` Maintained by ${MAINTAINER}.`}
        </p>
        <nav aria-label="Footer" className="-my-2 flex flex-wrap items-center gap-x-6 max-md:order-2 md:my-0 md:gap-x-3">
          <Link href="/changelog" className="flex h-11 items-center underline-offset-4 hover:text-foreground hover:underline">
            Changelog
          </Link>
          {repoPublic && (
            <>
              <a href={ISSUES_URL} className="flex h-11 items-center underline-offset-4 hover:text-foreground hover:underline">
                Report an issue
              </a>
              <a href={REPO_URL} className="flex h-11 items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline">
                <GithubIcon />
                GitHub
              </a>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
