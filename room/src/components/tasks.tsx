import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Jazzicon } from "@/components/identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useRoom, useSource } from "@/hooks/use-room";
import { useRovingFocus } from "@/hooks/use-roving-focus";
import { errMain, validOf } from "@/lib/api";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<TaskStatus, { icon: typeof CircleDotIcon; label: string; iconClass: string; badge: string }> = {
  open: { icon: CircleDashedIcon, label: "Open", iconClass: "text-muted-foreground", badge: "border-border text-muted-foreground" },
  claimed: { icon: CircleDotIcon, label: "Claimed", iconClass: "text-foreground", badge: "bg-secondary text-secondary-foreground" },
  done: { icon: CircleCheckIcon, label: "Done", iconClass: "text-presence", badge: "bg-presence/12 text-presence" },
};

const ORDER: Record<TaskStatus, number> = { open: 0, claimed: 1, done: 2 };
const who = (h: string) => (h === "you" ? "You" : h);

function Person({ handle }: { handle: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Jazzicon handle={handle} size={14} />
      <span className="truncate font-mono">{who(handle)}</span>
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function TaskCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[task.status] ?? STATUS.open;
  const Icon = status.icon;
  const done = task.status === "done";

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
    >
      <li className={cn("rounded-lg border bg-background/60 transition-colors", done && "bg-transparent", open && "bg-background")}>
        <CollapsibleTrigger
          data-roving-item
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Icon aria-hidden className={cn("size-3.5 shrink-0", status.iconClass)} />
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">#{task.id}</span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[13px] font-medium",
              done && "text-muted-foreground line-through decoration-muted-foreground/50",
            )}
          >
            {task.title}
          </span>
          {task.owner && (
            <>
              <Jazzicon handle={task.owner} size={16} />
              <span className="sr-only">{`, owned by ${who(task.owner)}, `}</span>
            </>
          )}
          <Badge variant="outline" className={cn("h-[18px] px-1.5 text-[10.5px] font-medium", status.badge)}>
            {status.label}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t px-3 py-2.5 text-[11px] leading-4">
            <Row label="Task">
              <span className="break-words">{task.title}</span>
            </Row>
            <Row label="Owner">{task.owner ? <Person handle={task.owner} /> : "Unclaimed"}</Row>
            {task.assignee && (
              <Row label="Assigned to">
                <Person handle={task.assignee} />
              </Row>
            )}
            {task.createdBy && (
              <Row label="Created by">
                <Person handle={task.createdBy} />
              </Row>
            )}
            {task.note && (
              <Row label="Note">
                <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-4 break-words whitespace-pre-wrap text-foreground/85">
                  {task.note}
                </code>
              </Row>
            )}
          </dl>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

function NewTask() {
  const { state, live, pollNow, endHuddle } = useRoom();
  const { post } = useSource();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [ok, setOk] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const okTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const describedBy = error ? `${id}-error` : undefined;
  const handles = live.map((a) => a.handle);
  const current = handles.includes(assignee) ? assignee : "";

  useEffect(() => () => clearTimeout(okTimer.current), []);
  useEffect(() => {
    if (state.ended) setOpen(false);
  }, [state.ended]);

  function close() {
    setOpen(false);
    setError(null);
    setOk("");
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function submit() {
    const t = title.trim();
    if (state.ended) return;
    if (!t) return titleRef.current?.focus();
    const body: { title: string; assignee?: string } = { title: t };
    if (current) body.assignee = current;
    try {
      const { r, data } = await post<{ id?: number }>("/api/tasks", body);
      if (r.status === 410) {
        endHuddle();
      } else if (r.ok) {
        setTitle("");
        setError(null);
        setOk(data?.id ? `Added task #${data.id}` : "Task added");
        clearTimeout(okTimer.current);
        okTimer.current = setTimeout(() => setOk(""), 2500);
        titleRef.current?.focus();
        pollNow();
      } else {
        setError({ message: errMain(r, data), valid: validOf(data), validLabel: "Valid assignees" });
      }
    } catch {
      setError({ message: "Could not reach the server." });
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setOpen(true);
          requestAnimationFrame(() => titleRef.current?.focus());
        } else close();
      }}
    >
      {!open && (
        <CollapsibleTrigger asChild>
          <Button
            ref={trigger}
            variant="outline"
            size="sm"
            disabled={state.ended}
            className="mt-2 w-full border-dashed bg-transparent text-muted-foreground hover:text-foreground dark:bg-transparent"
          >
            <PlusIcon aria-hidden />
            New task
          </Button>
        </CollapsibleTrigger>
      )}
      <CollapsibleContent className="overflow-hidden motion-safe:data-open:animate-collapsible-down motion-safe:data-closed:animate-collapsible-up">
        <form
          autoComplete="off"
          aria-label="New task"
          className="mt-2 grid gap-3 rounded-lg border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !e.defaultPrevented) {
              e.preventDefault();
              close();
            }
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-title`} className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              ref={titleRef}
              id={`${id}-title`}
              aria-describedby={describedBy}
              value={title}
              maxLength={200}
              placeholder="What needs doing?"
              disabled={state.ended}
              onChange={(e) => setTitle(e.target.value)}
              className="font-normal text-foreground"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-assignee`} className="text-xs font-medium text-muted-foreground">
              Assign to
            </label>
            <NativeSelect
              id={`${id}-assignee`}
              aria-describedby={describedBy}
              value={current}
              disabled={state.ended}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full font-normal text-foreground"
            >
              <NativeSelectOption value="">Unassigned</NativeSelectOption>
              {handles.map((h) => (
                <NativeSelectOption key={h} value={h}>
                  {h}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {error && <ErrorBox id={`${id}-error`} error={error} />}
          <div role="status" className="text-xs text-presence empty:hidden">
            {ok}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={state.ended}>
              Add task
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Tasks() {
  const { state } = useRoom();
  const { tasks } = state;
  const done = tasks.filter((t) => t.status === "done").length;
  const sorted = tasks.slice().sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || a.id - b.id);
  const roving = useRovingFocus<HTMLUListElement>();

  return (
    <section aria-labelledby="tasks-h" className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="tasks-h" className="text-xs font-medium text-muted-foreground">
          Tasks
        </h3>
        {tasks.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {done}/{tasks.length} done
          </span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
          No tasks yet. Agents add them as they split the work, or add one yourself.
        </p>
      ) : (
        <ul {...roving} className="mt-2 flex flex-col gap-1.5">
          {sorted.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </ul>
      )}
      <NewTask />
    </section>
  );
}
