import { CornerDownRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { HarnessDot, PresenceAvatar } from "@/components/identity";
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
import { useRoom } from "@/hooks/use-room";
import { fmtAgo, fullTime } from "@/lib/format";
import type { Agent, AgentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUPS: [AgentStatus, string][] = [
  ["active", "Active"],
  ["idle", "Idle"],
  ["left", "Left"],
];

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

function AgentRow({ agent, depth }: { agent: Agent; depth: number }) {
  const { expandedAgent, setExpandedAgent } = usePanels();
  const { state, isMobile, setOpen } = useSidebar();
  const open = expandedAgent === agent.handle;

  return (
    <Collapsible asChild open={open} onOpenChange={(o) => setExpandedAgent(o ? agent.handle : null)}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={`${agent.handle} · ${agent.status}`}
            className={cn("h-9 gap-2.5 group-data-[collapsible=icon]:p-1.5!", agent.status === "left" && "opacity-55")}
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
            <PresenceAvatar handle={agent.handle} status={agent.status} />
            <span className="min-w-0 truncate font-mono text-xs font-medium">{agent.handle}</span>
            {agent.role && <span className="min-w-0 truncate text-[11px] text-muted-foreground">{agent.role}</span>}
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
                <HarnessDot harness={agent.harness} />
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

  return (
    <Sidebar side="left" collapsible="icon" role="complementary" aria-label="Agents">
      <SidebarHeader className="h-12 flex-row items-center gap-2.5 border-b px-3 group-data-[collapsible=icon]:px-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-foreground/80">
          <Mark />
        </span>
        <span className="min-w-0 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">In the room</span>
        {agents.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden">
            {nActive} active
          </span>
        )}
      </SidebarHeader>
      <SidebarContent>
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
                <SidebarGroupLabel className="gap-1.5">
                  {label}
                  <span className="text-muted-foreground/70 tabular-nums">{members.length}</span>
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

/** Phone-width roster: the demo's horizontal strip of agent chips. Tapping one opens its detail. */
export function AgentStrip() {
  const { state } = useRoom();
  const { openAgents } = usePanels();
  if (!state.agents.length) return null;
  const order: Record<AgentStatus, number> = { active: 0, idle: 1, left: 2 };
  const agents = state.agents.slice().sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="relative min-w-0 flex-1">
      <ul aria-label="Agents in the room" className="flex gap-1.5 overflow-x-auto py-2 pr-6 pl-3 [scrollbar-width:none]">
        {agents.map((a) => (
          <li key={a.handle} className="shrink-0">
            <button
              type="button"
              onClick={() => openAgents(a.handle)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border px-2.5 transition-[opacity,background-color] hover:bg-muted",
                a.status === "left" && "opacity-45",
              )}
            >
              <PresenceAvatar handle={a.handle} status={a.status} ringClass="ring-background bg-background" />
              <span className="font-mono text-xs font-medium">{a.handle}</span>
              <span className="sr-only">{`, ${a.status}. Show details`}</span>
            </button>
          </li>
        ))}
      </ul>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
