import { CircleAlertIcon, CircleStopIcon, CopyIcon, UsersIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { base } from "@/lib/api";
import { fmtTime, fullTime } from "@/lib/format";
import type { HomeResponse } from "@/lib/types";

const WRONG = "This home link is wrong. Run agent-huddle home to open the current one.";
const DOWN = "The huddle server is not answering. Run agent-huddle home to start it again.";

/** Polls the room list every 5 seconds; a wrong link stops polling. */
function useHome() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`${base}/api/rooms`, { cache: "no-store" });
        if (r.status === 401) return setNotice(WRONG);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
        setNotice("");
      } catch {
        setNotice(DOWN);
      }
      if (!stopped) timer = setTimeout(load, 5000);
    };
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  return { data, notice };
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  const id = `${title.toLowerCase().replace(/\s+/g, "-")}-heading`;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="flex items-baseline gap-2 text-sm font-medium">
        {title}
        {count != null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground">{children}</p>
);

const Loading = () => (
  <div aria-hidden className="space-y-2">
    <Skeleton className="h-16" />
    <Skeleton className="h-16" />
  </div>
);

const ShortId = ({ id }: { id: string }) => <span className="font-mono text-[11px] text-muted-foreground">{id}</span>;

function LiveRooms({ rooms }: { rooms: HomeResponse["live"] }) {
  if (!rooms.length)
    return (
      <Empty>
        No live rooms. Start one with{" "}
        <code className="rounded-md border bg-background px-1.5 font-mono text-xs text-foreground/80">/huddle-start</code> in any agent.
      </Empty>
    );
  return (
    <ul className="space-y-2">
      {rooms.map((r) => (
        <li key={r.id}>
          <a
            href={r.page}
            className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-presence ring-3 ring-presence/15 forced-color-adjust-none" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{r.name}</span>
                <ShortId id={r.id} />
              </span>
              <span className="block text-xs text-muted-foreground">
                Started <time dateTime={r.createdAt}>{fullTime(r.createdAt)}</time>
              </span>
            </span>
            <span
              className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
              aria-label={`${r.agents.active} of ${r.agents.total} agents active`}
            >
              <UsersIcon aria-hidden className="size-3.5" />
              <span className="font-mono tabular-nums">
                {r.agents.active}/{r.agents.total}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function PastRooms({ rooms }: { rooms: HomeResponse["past"] }) {
  if (!rooms.length) return <Empty>No past rooms yet. A room shows here once it ends, to read again.</Empty>;
  return (
    <ul className="space-y-2">
      {rooms.map((r) => (
        <li key={r.page} className="rounded-lg border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <CircleStopIcon aria-hidden className="size-3.5 shrink-0 self-center text-muted-foreground" />
            <a
              href={r.page}
              className="min-w-0 truncate rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {r.name}
            </a>
            <ShortId id={r.id} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Started <time dateTime={r.createdAt}>{fullTime(r.createdAt)}</time>
            {r.ended ? (
              <>
                {" · Ended "}
                <time dateTime={r.ended.at}>{sameDay(r.ended.at, r.createdAt) ? fmtTime(r.ended.at) : fullTime(r.ended.at)}</time>
                {r.ended.reason && ` (${r.ended.reason})`}
              </>
            ) : (
              " · No end recorded"
            )}
          </p>
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs">
            <span className="shrink-0 text-muted-foreground">Transcript</span>
            <code className="min-w-0 truncate rounded-md border bg-background px-1.5 font-mono text-foreground/80" title={r.transcript}>
              {r.transcript}
            </code>
            <CopyButton
              text={r.transcript}
              label={`Copy transcript path of ${r.name}`}
              labelClassName="sr-only"
              icon={<CopyIcon aria-hidden />}
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground"
            />
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Your rooms on this machine: live ones open their page, past ones open read-only from history. Browse only. */
export function Home() {
  const { data, notice } = useHome();
  useEffect(() => {
    document.title = "Rooms · agent-huddle";
  }, []);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-2 px-4">
          <h1 className="text-sm font-medium">Your rooms</h1>
          <Badge
            variant="outline"
            title="These rooms run only on this machine"
            className="ml-auto gap-1.5 font-normal text-muted-foreground"
          >
            local <span className="font-mono text-[11px] text-foreground/80">{location.host}</span>
          </Badge>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {notice && (
          <p
            role="alert"
            className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] font-medium text-destructive"
          >
            <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
            {notice}
          </p>
        )}
        <Section title="Live" count={data?.live.length}>
          {data ? <LiveRooms rooms={data.live} /> : !notice && <Loading />}
        </Section>
        <Section title="Past" count={data?.past.length}>
          {data ? <PastRooms rooms={data.past} /> : !notice && <Loading />}
        </Section>
      </main>
    </div>
  );
}
