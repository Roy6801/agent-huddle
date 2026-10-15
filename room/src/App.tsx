import { CircleAlertIcon, CircleStopIcon, ShieldQuestionIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AgentsPanel } from "@/components/agents-panel";
import { Board } from "@/components/board";
import { Chat } from "@/components/chat";
import { Header } from "@/components/header";
import { PinnedBrief } from "@/components/pinned-brief";
import { ShortcutsDialog, useShortcutsKey } from "@/components/shortcuts";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnnouncements } from "@/hooks/use-announcements";
import { PanelsContext, usePersistedOpen, type Panels } from "@/hooks/use-panels";
import { RoomContext, SourceContext, useDerived, useRoom, type Room, type RoomSource } from "@/hooks/use-room";

/** First tab stop on the page. The message box, or the feed once the room has ended. */
function SkipLink() {
  return (
    <a
      href="#composer-text"
      className="sr-only rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      onClick={(e) => {
        e.preventDefault();
        const box = document.getElementById("composer-text") as HTMLTextAreaElement | null;
        (box && !box.disabled ? box : document.querySelector<HTMLElement>('[role="log"]'))?.focus();
      }}
    >
      Skip to message box
    </a>
  );
}

function Banners() {
  const { state, atCap } = useRoom();
  const asking = state.asks.filter((a) => a.status === "open").length;
  return (
    <>
      {state.notice && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2.5 border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] font-medium text-destructive"
        >
          <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
          {state.notice}
        </div>
      )}
      {atCap && !state.ended && (
        <p className="flex shrink-0 items-center gap-2 border-b border-signal/20 bg-signal/5 px-4 py-2 text-[13px] leading-5 font-medium text-signal md:hidden">
          <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
          Agents are waiting on you. Reply to continue.
        </p>
      )}
      {asking > 0 && !state.ended && (
        <p
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-signal/20 bg-signal/5 px-4 py-2 text-[13px] leading-5 font-medium text-signal"
        >
          <ShieldQuestionIcon aria-hidden className="size-4 shrink-0" />
          {asking === 1 ? "1 approval is waiting on you." : `${asking} approvals are waiting on you.`}
        </p>
      )}
      {state.ended && (
        <div className="flex shrink-0 items-start gap-3 border-b bg-muted/50 px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground">
            <CircleStopIcon aria-hidden className="size-4" />
          </span>
          <div className="text-[13px] leading-5">
            <strong className="block font-semibold">This room has ended</strong>
            {state.endedNote && <span className="block break-words text-muted-foreground">{state.endedNote}</span>}
            <span className="text-muted-foreground">
              Start a new one with{" "}
              <code className="rounded-md border bg-background px-1.5 font-mono text-xs text-foreground/80">/huddle-start</code>{" "}
              in any agent.
            </span>
          </div>
        </div>
      )}
    </>
  );
}

type SidebarControls = ReturnType<typeof useSidebar>;

/** Hands the board's sidebar controls up to the shell, which sits outside the board's provider. */
function BoardBridge({ into }: { into: { current: SidebarControls | null } }) {
  const board = useSidebar();
  useEffect(() => {
    into.current = board;
  }, [into, board]);
  return null;
}

/**
 * Two independent shadcn sidebars need two providers: the agents provider wraps everything, the
 * board's provider wraps the centre column. Panel actions are shared through PanelsContext.
 */
function Shell() {
  const agents = useSidebar();
  const boardControls = useRef<SidebarControls | null>(null);
  const [board, setBoard] = usePersistedOpen("agent-huddle.board-open.v2", () => true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [capRequest, setCapRequest] = useState(0);
  const [shortcuts, setShortcuts] = useState(false);
  const showShortcuts = useCallback(() => setShortcuts(true), []);
  useShortcutsKey(showShortcuts);

  const openAgents = useCallback(
    (handle?: string) => {
      if (handle) setExpandedAgent(handle);
      if (agents.isMobile) agents.setOpenMobile(true);
      else agents.setOpen(true);
    },
    [agents],
  );
  const openBoard = useCallback(
    (section?: "cap") => {
      if (agents.isMobile) boardControls.current?.setOpenMobile(true);
      else setBoard(true);
      if (section === "cap") setCapRequest((n) => n + 1);
    },
    [agents.isMobile, setBoard],
  );
  const panels = useMemo<Panels>(
    () => ({ expandedAgent, setExpandedAgent, openAgents, openBoard, capRequest }),
    [expandedAgent, openAgents, openBoard, capRequest],
  );

  return (
    <PanelsContext.Provider value={panels}>
      <SkipLink />
      <AgentsPanel />
      <SidebarInset asChild className="min-h-0 min-w-0 overflow-hidden">
        <div>
          <SidebarProvider
            open={board}
            onOpenChange={setBoard}
            keyboardShortcut="."
            className="min-h-0 flex-1"
            style={{ "--sidebar-width": "19rem" } as CSSProperties}
          >
            <BoardBridge into={boardControls} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header
                agentsOpen={agents.isMobile ? agents.openMobile : agents.open}
                onToggleAgents={agents.toggleSidebar}
                onShowShortcuts={showShortcuts}
              />
              <main id="main" className="flex min-h-0 flex-1 flex-col">
                <Banners />
                <PinnedBrief />
                <Chat />
              </main>
            </div>
            <Board />
          </SidebarProvider>
        </div>
      </SidebarInset>
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </PanelsContext.Provider>
  );
}

export function App({ source }: { source: RoomSource }) {
  const { state, pollNow, endHuddle } = source.useRoomState();
  const { identities, live, files, atCap } = useDerived(state);
  const [agentsOpen, setAgentsOpen] = usePersistedOpen("agent-huddle.agents-open.v2", () => true);
  const { live: spoken, announce } = useAnnouncements(state, source.quiet);

  const room = useMemo<Room>(
    () => ({ state, pollNow, endHuddle, announce, identities, live, files, atCap }),
    [state, pollNow, endHuddle, announce, identities, live, files, atCap],
  );

  return (
    <SourceContext.Provider value={source}>
      <RoomContext.Provider value={room}>
        <TooltipProvider delayDuration={300}>
          <SidebarProvider
            open={agentsOpen}
            onOpenChange={setAgentsOpen}
            className="h-svh min-h-0 overflow-hidden"
            style={{ "--sidebar-width": "15rem" } as CSSProperties}
          >
            <Shell />
          </SidebarProvider>
          <div role="status" className="sr-only">
            {spoken.polite}
          </div>
          <div role="alert" className="sr-only">
            {spoken.assertive}
          </div>
        </TooltipProvider>
      </RoomContext.Provider>
    </SourceContext.Provider>
  );
}
