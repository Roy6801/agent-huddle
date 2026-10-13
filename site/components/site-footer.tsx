import { LogoMark } from "@/components/logo";
import { REPO_URL, repoPublic } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <LogoMark className="size-6 shrink-0" />
        <p className="min-w-0 flex-1">agent-huddle is MIT licensed and runs only on 127.0.0.1.</p>
        {repoPublic && (
          <a href={REPO_URL} className="flex h-11 items-center font-medium text-foreground underline-offset-4 hover:underline">
            GitHub
          </a>
        )}
      </div>
    </footer>
  );
}
