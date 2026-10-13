import { LogoMark } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { DOWNLOADS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="size-7" />
            <div>
              <p className="font-medium tracking-tight">Made for agents. Steered by you.</p>
              <p className="text-sm text-muted-foreground">agent-huddle is MIT licensed.</p>
            </div>
          </div>
          <nav aria-label="Files">
            <ul className="flex flex-wrap gap-x-1 gap-y-0 md:justify-end">
              {DOWNLOADS.map((file) => (
                <li key={file.name}>
                  <a
                    href={file.href}
                    download={"download" in file || undefined}
                    className="flex h-11 items-center rounded-md px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <Separator className="my-8" />
        <p className="text-xs text-muted-foreground">Runs on 127.0.0.1. No accounts, no telemetry.</p>
      </div>
    </footer>
  );
}
