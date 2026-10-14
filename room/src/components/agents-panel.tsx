import { CornerDownRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { GroupAvatar, HarnessDot, Jazzicon, PresenceAvatar } from "@/components/identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePanels } from "@/hooks/use-panels";
import { useRoom, useSource } from "@/hooks/use-room";
import { useRovingFocus } from "@/hooks/use-roving-focus";
import { errMain } from "@/lib/api";
import { fmtAgo, fullTime } from "@/lib/format";
import type { Agent, AgentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUPS: [AgentStatus, string][] = [
  ["active", "Active"],
  ["idle", "Idle"],
  ["left", "Left"],
];

const ORDER: Record<AgentStatus, number> = { active: 0, idle: 1, left: 2 };

const STATUS_TEXT: Record<AgentStatus, string> = {
  active: "Active",
  idle: "Idle",
  left: "Left the room",
};

/** Members of one status group as a parent-first list with their nesting depth. */
function tree(members: Agent[]) {
  const inGroup = new Set(members.map((a) => a.handle));
  const byParent = new Map<string, Agent[]>();
  for (const a of members) {
    const p = a.parent && inGroup.has(a.parent) ? a.parent : "";
    byParent.set(p, [...(byParent.get(p) ?? []), a]);
  }
  const out: { agent: Agent; depth: number }[] = [];
  const walk = (parent: string, depth: number) => {
    for (const a of byParent.get(parent) ?? []) {
      out.push({ agent: a, depth });
      walk(a.handle, depth + 1);
    }
  };
  walk("", 0);
  return out;
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={cn("size-4", className)}
    >
      <circle cx="8.5" cy="12" r="5" />
      <circle cx="15.5" cy="12" r="5" />
    </svg>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </>
  );
}

function StopButton({ handle, requested }: { handle: string; requested: boolean }) {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function stop() {
    setError("");
    setSending(true);
    try {
      const { r, data } = await post(`/api/agents/${handle}/stop`, {});
      if (!r.ok) {
        setSending(false);
        return setError(errMain(r, data));
      }
      pollNow();
    } catch {
      setSending(false);
      setError("Could not reach the room server.");
    }
  }

  if (requested) return <p className="col-span-2 text-muted-foreground">Stopping after its current run</p>;
  return (
    <div className="col-span-2 mt-1 grid gap-1">
      <Button
        variant="outline"
        size="xs"
        disabled={state.ended || sending}
        onClick={stop}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        Stop {handle}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function AgentRow({ agent, depth }: { agent: Agent; depth: number }) {
  const { expandedAgent, setExpandedAgent } = usePanels();
  const { state, isMobile, setOpen } = useSidebar();
  const open = expandedAgent === agent.handle;

  return (
    <Collapsible asChild open={open} onOpenChange={(o) => setExpandedAgent(o ? agent.handle : null)}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            data-roving-item
            // The drawer never shows it, and a hidden tooltip would swallow the first Esc.
            tooltip={isMobile ? undefined : `${agent.handle} · ${agent.status}`}
            className={cn("h-9 gap-2.5 group-data-[collapsible=icon]:p-1.5!", agent.status === "left" && "text-muted-foreground")}
            onClick={() => {
              if (state === "collapsed" && !isMobile) setOpen(true);
            }}
          >
            {depth > 0 && (
              <span
                aria-hidden
                className="flex shrink-0 justify-end group-data-[collapsible=icon]:hidden"
                style={{ width: depth * 14 }}
              >
                <CornerDownRightIcon className="size-3.5! text-muted-foreground" />
              </span>
            )}
            <PresenceAvatar
              handle={agent.handle}
              status={agent.status}
              className={cn(agent.status === "left" && "opacity-55")}
            />
            <span className="min-w-0 truncate font-mono text-xs font-medium">{agent.handle}</span>
            {agent.role === "headless" ? (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                headless
              </Badge>
            ) : (
              agent.role && <span className="min-w-0 truncate text-[11px] text-muted-foreground">{agent.role}</span>
            )}
            <HarnessDot harness={agent.harness} className="ml-auto group-data-[collapsible=icon]:hidden" />
            <span className="sr-only">{`, ${agent.status}`}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden group-data-[collapsible=icon]:hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
          <dl className="mx-1 mt-0.5 mb-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md bg-sidebar-accent/60 px-2.5 py-2 text-[11px] leading-4">
            <Detail label="Status">
              {STATUS_TEXT[agent.status]}
            </Detail>
            <Detail label="Harness">
              <span className="inline-flex items-center gap-1.5">
                <HarnessDot harness={agent.harness} decorative />
                {agent.harness}
              </span>
            </Detail>
            {agent.role && <Detail label="Role">{agent.role}</Detail>}
            {agent.parent && (
              <Detail label="Spawned by">
                <span className="font-mono">{agent.parent}</span>
              </Detail>
            )}
            <Detail label="Last seen">
              <time dateTime={agent.lastSeen} title={fullTime(agent.lastSeen)}>
                {fmtAgo(agent.lastSeen)}
              </time>
            </Detail>
            {agent.role === "headless" && agent.status !== "left" && <StopButton handle={agent.handle} requested={agent.stopRequested === true} />}
          </dl>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AgentsPanel() {
  const { state } = useRoom();
  const { agents } = state;
  const nActive = agents.filter((a) => a.status === "active").length;
  const roving = useRovingFocus<HTMLDivElement>();

  return (
    <Sidebar side="left" collapsible="icon" role="complementary" aria-label="Agents">
      <SidebarHeader className="h-12 flex-row items-center gap-2.5 border-b px-3 group-data-[collapsible=icon]:px-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-foreground/80">
          <Mark />
        </span>
        <h2 className="min-w-0 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">In the room</h2>
        {agents.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden">
            {nActive} active
          </span>
        )}
      </SidebarHeader>
      <SidebarContent {...roving}>
        {agents.length === 0 ? (
          <p className="px-4 py-3 text-xs leading-5 text-muted-foreground group-data-[collapsible=icon]:hidden">
            No agents yet. Share the join link to bring them in.
          </p>
        ) : (
          GROUPS.map(([status, label]) => {
            const members = agents.filter((a) => a.status === status);
            if (!members.length) return null;
            return (
              <SidebarGroup key={status} className="py-1">
                <SidebarGroupLabel asChild className="gap-1.5">
                  <h3>
                    {label}
                    <span className="tabular-nums">{members.length}</span>
                  </h3>
                </SidebarGroupLabel>
                <SidebarMenu className="gap-0.5">
                  {tree(members).map(({ agent, depth }) => (
                    <AgentRow key={agent.handle} agent={agent} depth={depth} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/** Phone header: up to three overlapping avatars, presence on the front one, opening the agents drawer. */
export function AgentStack({ expanded, onClick, className }: { expanded: boolean; onClick: () => void; className?: string }) {
  const { live } = useRoom();
  const sorted = live.slice().sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const shown = sorted.slice(0, 3);
  const extra = sorted.length - shown.length;
  const nActive = live.filter((a) => a.status === "active").length;
  const name = live.length ? `Agents, ${live.length} in the room, ${nActive} active` : "Agents, none in the room yet";

  return (
    <Button
      variant="ghost"
      aria-label={name}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      onClick={onClick}
      className={cn("h-11 shrink-0 gap-1 px-1.5", className)}
    >
      {shown.length ? (
        <span className="flex items-center">
          {shown.map((a, i) =>
            i === 0 ? (
              <PresenceAvatar
                key={a.handle}
                handle={a.handle}
                status={a.status}
                size={26}
                ringClass="ring-background bg-background"
                className="z-3 rounded-full ring-2 ring-background"
              />
            ) : (
              <Jazzicon
                key={a.handle}
                handle={a.handle}
                size={26}
                className={cn("relative -ml-2.5 ring-2 ring-background", i === 1 ? "z-2" : "z-1")}
              />
            ),
          )}
        </span>
      ) : (
        <GroupAvatar size={26} />
      )}
      {extra > 0 && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{extra}</span>}
    </Button>
  );
}
