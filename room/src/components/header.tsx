import { CircleStopIcon, LinkIcon, ListChecksIcon, PanelLeftIcon, PanelRightIcon, TriangleAlertIcon } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { CapMeter } from "@/components/round-cap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePanels } from "@/hooks/use-panels";
import { useRoom } from "@/hooks/use-room";
import type { Conn } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONN_TEXT: Record<Conn, string> = {
  connecting: "Connecting",
  live: "Connected",
  bad: "Disconnected, retrying",
  gone: "Room unavailable",
  ended: "Ended",
};

function Connection({ conn }: { conn: Conn }) {
  const text = CONN_TEXT[conn];
  const bad = conn === "bad" || conn === "gone";
  return (
    <span
      role="status"
      title={text}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-2 rounded-full text-xs whitespace-nowrap text-muted-foreground",
        bad ? "bg-destructive/10 px-2.5 text-destructive" : "px-1",
      )}
    >
      {conn === "ended" ? (
        <CircleStopIcon aria-hidden className="size-3.5" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            conn === "live" ? "bg-presence ring-3 ring-presence/15" : bad ? "bg-destructive" : "bg-muted-foreground/50",
          )}
        />
      )}
      <span className={cn(conn === "live" && "sr-only sm:not-sr-only")}>{text}</span>
    </span>
  );
}

export function Header({ onToggleAgents, onToggleBoard }: { onToggleAgents: () => void; onToggleBoard: () => void }) {
  const { state, atCap } = useRoom();
  const { openBoard } = usePanels();
  const { name, joinUrl, conn, ended } = state;
  let host = location.host;
  try {
    if (joinUrl) host = new URL(joinUrl).host;
  } catch {
    // keep the page host
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b bg-background pr-2 pl-2 sm:gap-2 sm:pr-3">
      <Button variant="ghost" size="icon-sm" aria-label="Toggle agents" title="Agents" onClick={onToggleAgents}>
        <PanelLeftIcon aria-hidden />
      </Button>
      <h1 className="min-w-0 truncate text-sm font-medium">{name || "Huddle"}</h1>
      <Badge
        variant="outline"
        title="This room runs only on this machine"
        className="hidden gap-1.5 font-normal text-muted-foreground sm:inline-flex"
      >
        local <span className="font-mono text-[11px] text-foreground/80">{host}</span>
      </Badge>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        {atCap && !ended && (
          <Button
            variant="ghost"
            size="sm"
            className="bg-signal/10 text-signal hover:bg-signal/15 hover:text-signal"
            onClick={() => openBoard("cap")}
          >
            <TriangleAlertIcon aria-hidden />
            <span className="hidden sm:inline">Waiting on you</span>
            <span className="sr-only sm:hidden">Agents are waiting on you</span>
          </Button>
        )}
        <Connection conn={conn} />
        <CopyButton
          text={joinUrl}
          label="Copy join link"
          title={joinUrl ? `Copy join link: ${joinUrl}` : undefined}
          aria-label="Copy join link"
          icon={<LinkIcon aria-hidden />}
          labelClassName="hidden sm:inline"
          variant="outline"
          size="sm"
          disabled={ended || !joinUrl}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle board: round cap and tasks"
          title="Round cap and tasks"
          onClick={onToggleBoard}
          className="hidden md:inline-flex"
        >
          <PanelRightIcon aria-hidden />
        </Button>
      </div>
    </header>
  );
}

/** Phone-width row under the header: agents strip plus a compact tasks and round cap summary. */
export function MobileBoardButton() {
  const { state } = useRoom();
  const { openBoard } = usePanels();
  const open = state.tasks.filter((t) => t.status !== "done").length;
  return (
    <Button
      variant="outline"
      size="sm"
      className="mr-3 ml-auto shrink-0 gap-2"
      aria-label={`Board: ${open} open tasks, round cap`}
      onClick={() => openBoard()}
    >
      <ListChecksIcon aria-hidden />
      <span className="tabular-nums">{open}</span>
      <CapMeter compact />
    </Button>
  );
}
