import {
  CircleStopIcon,
  KeyboardIcon,
  LinkIcon,
  ListChecksIcon,
  PanelLeftIcon,
  PanelRightIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { AgentStack } from "@/components/agents-panel";
import { CopyButton } from "@/components/copy-button";
import { CapRing, capText } from "@/components/round-cap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { usePanels } from "@/hooks/use-panels";
import { useRoom } from "@/hooks/use-room";
import { isMac, MOD } from "@/lib/keyboard";
import type { Conn } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONN_TEXT: Record<Conn, string> = {
  connecting: "Connecting",
  live: "Connected",
  bad: "Disconnected, retrying",
  gone: "Room unavailable",
  ended: "Ended",
};

function ConnDot({ conn }: { conn: Conn }) {
  if (conn === "ended") return <CircleStopIcon aria-hidden className="size-3.5 shrink-0" />;
  const bad = conn === "bad" || conn === "gone";
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full forced-color-adjust-none",
        conn === "live" ? "bg-presence ring-3 ring-presence/15" : bad ? "bg-destructive" : "bg-muted-foreground/50",
      )}
    />
  );
}

/** Desktop pill. Changes are announced by App, so this is not a live region. */
function Connection({ conn, className }: { conn: Conn; className?: string }) {
  const text = CONN_TEXT[conn];
  const bad = conn === "bad" || conn === "gone";
  return (
    <span
      title={text}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-2 rounded-full text-xs whitespace-nowrap text-muted-foreground",
        bad ? "bg-destructive/10 px-2.5 text-destructive" : "px-1",
        className,
      )}
    >
      <ConnDot conn={conn} />
      <span className={cn(conn === "live" && "sr-only sm:not-sr-only")}>{text}</span>
    </span>
  );
}

/** Phone: one button for the board, with tasks done and the round cap as a ring. */
function BoardButton({ expanded, className }: { expanded: boolean; className?: string }) {
  const { state, atCap } = useRoom();
  const { openBoard } = usePanels();
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.status === "done").length;
  const cap = capText(state.roundCap, state.streak, atCap);
  const name = [
    "Board",
    total ? `${done} of ${total} tasks done` : "no tasks",
    cap && (state.roundCap === null ? "no round cap" : cap),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Button
      variant="ghost"
      aria-label={name}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      onClick={() => openBoard()}
      className={cn("h-11 shrink-0 gap-2 px-2.5", className)}
    >
      <ListChecksIcon aria-hidden className="text-muted-foreground" />
      {total > 0 && (
        <span className="font-mono text-xs tabular-nums">
          {done}/{total}
        </span>
      )}
      <CapRing />
    </Button>
  );
}

/** Lives inside the board's sidebar provider; the agents panel's state comes in as props. */
export function Header({
  agentsOpen,
  onToggleAgents,
  onShowShortcuts,
}: {
  agentsOpen: boolean;
  onToggleAgents: () => void;
  onShowShortcuts: () => void;
}) {
  const { state, atCap } = useRoom();
  const { openBoard } = usePanels();
  const board = useSidebar();
  const boardOpen = board.isMobile ? board.openMobile : board.open;
  const { name, joinUrl, conn, ended } = state;
  const keys = (key: string) => (isMac ? `Meta+${key}` : `Control+${key}`);
  let host = location.host;
  try {
    if (joinUrl) host = new URL(joinUrl).host;
  } catch {
    // keep the page host
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b bg-background px-1.5 md:h-12 md:gap-2 md:pr-3 md:pl-2">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Agents panel"
        aria-expanded={agentsOpen}
        aria-keyshortcuts={keys("B")}
        title={`Agents panel (${MOD}+B)`}
        onClick={onToggleAgents}
        className="hidden md:inline-flex"
      >
        <PanelLeftIcon aria-hidden />
      </Button>
      <AgentStack expanded={agentsOpen} onClick={onToggleAgents} className="md:hidden" />
      <div className="min-w-0 flex-1 md:max-w-64 md:flex-none">
        <h1 className="truncate text-sm font-medium">{name || "Huddle"}</h1>
        <p className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground md:hidden">
          <ConnDot conn={conn} />
          <span className={cn("truncate", (conn === "bad" || conn === "gone") && "text-destructive")}>
            {CONN_TEXT[conn]}
          </span>
        </p>
      </div>
      <Badge
        variant="outline"
        title="This room runs only on this machine"
        className="hidden min-w-0 shrink gap-1.5 font-normal text-muted-foreground md:inline-flex"
      >
        local <span className="truncate font-mono text-[11px] text-foreground/80">{host}</span>
      </Badge>
      <div className="flex shrink-0 items-center gap-0.5 md:ml-auto md:gap-1.5">
        {atCap && !ended && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden bg-signal/10 text-signal hover:bg-signal/15 hover:text-signal md:inline-flex"
            onClick={() => openBoard("cap")}
          >
            <TriangleAlertIcon aria-hidden />
            Waiting on you
          </Button>
        )}
        <Connection conn={conn} className="hidden md:inline-flex" />
        <BoardButton expanded={boardOpen} className="md:hidden" />
        <CopyButton
          text={joinUrl}
          label="Copy join link"
          title={joinUrl ? `Copy join link: ${joinUrl}` : undefined}
          icon={<LinkIcon aria-hidden />}
          labelClassName="sr-only md:not-sr-only"
          variant="outline"
          size="sm"
          disabled={ended || !joinUrl}
          className="max-md:size-11 max-md:border-transparent max-md:bg-transparent max-md:px-0 max-md:dark:border-transparent max-md:dark:bg-transparent"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="?"
          title="Keyboard shortcuts (?)"
          onClick={onShowShortcuts}
          className="hidden md:inline-flex"
        >
          <KeyboardIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Board: round cap and tasks"
          aria-expanded={boardOpen}
          aria-keyshortcuts={keys(".")}
          title={`Board (${MOD}+.)`}
          onClick={board.toggleSidebar}
          className="hidden md:inline-flex"
        >
          <PanelRightIcon aria-hidden />
        </Button>
      </div>
    </header>
  );
}
