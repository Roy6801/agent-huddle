import { CircleAlertIcon, CircleStopIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AgentStrip, AgentsPanel } from "@/components/agents-panel";
import { Board } from "@/components/board";
import { Chat } from "@/components/chat";
import { Header, MobileBoardButton } from "@/components/header";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PanelsContext, usePersistedOpen, type Panels } from "@/hooks/use-panels";
import { RoomContext, useDerived, useRoom, useRoomState, type Room } from "@/hooks/use-room";

const wide = () => window.matchMedia("(min-width: 1024px)").matches;

function Banners() {
  const { state } = useRoom();
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
      {state.ended && (
        <div role="status" className="flex shrink-0 items-start gap-3 border-b bg-muted/50 px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground">
            <CircleStopIcon aria-hidden className="size-4" />
          </span>
          <div className="text-[13px] leading-5">
            <strong className="block font-semibold">This room has ended</strong>
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
  const [board, setBoard] = usePersistedOpen("agent-huddle.board-open", wide);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [capRequest, setCapRequest] = useState(0);

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
      <AgentsPanel />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
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
              onToggleAgents={agents.toggleSidebar}
              onToggleBoard={() => boardControls.current?.toggleSidebar()}
            />
            <div className="flex shrink-0 items-center border-b md:hidden">
              <AgentStrip />
              <MobileBoardButton />
            </div>
            <Banners />
            <Chat />
          </div>
          <Board />
        </SidebarProvider>
      </SidebarInset>
    </PanelsContext.Provider>
  );
}

export function App() {
  const { state, pollNow, endHuddle } = useRoomState();
  const { identities, live, files, atCap } = useDerived(state);
  const [announcement, setAnnouncement] = useState("");
  const [agentsOpen, setAgentsOpen] = usePersistedOpen("agent-huddle.agents-open", wide);
  const wasAtCap = useRef(false);

  const announce = useCallback((msg: string) => {
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(msg));
  }, []);

  const room = useMemo<Room>(
    () => ({ state, pollNow, endHuddle, announce, identities, live, files, atCap }),
    [state, pollNow, endHuddle, announce, identities, live, files, atCap],
  );

  useEffect(() => {
    if (state.name) document.title = `Huddle · ${state.name}`;
  }, [state.name]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-ended", state.ended);
  }, [state.ended]);

  useEffect(() => {
    if (atCap && !wasAtCap.current) announce("Agents are waiting on you.");
    wasAtCap.current = atCap;
  }, [atCap, announce]);

  return (
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
          {announcement}
        </div>
      </TooltipProvider>
    </RoomContext.Provider>
  );
}
