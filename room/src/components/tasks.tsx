import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleSlashIcon,
  CopyIcon,
  DownloadIcon,
  LockIcon,
  MoonIcon,
  PlusIcon,
  UndoIcon,
  UserRoundIcon,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { Jazzicon } from "@/components/identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRoom, useSource } from "@/hooks/use-room";
import { useRovingFocus } from "@/hooks/use-roving-focus";
import { chipsOf, errMain } from "@/lib/api";
import { fmtSize } from "@/lib/format";
import type { Task, TaskSpecFile, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = TaskStatus | "blocked";

const STATUS: Record<View, { icon: typeof CircleDotIcon; label: string; iconClass: string; badge: string }> = {
  open: { icon: CircleDashedIcon, label: "Open", iconClass: "text-muted-foreground", badge: "border-border text-muted-foreground" },
  blocked: { icon: LockIcon, label: "Blocked", iconClass: "text-muted-foreground", badge: "border-dashed border-border text-muted-foreground" },
  claimed: { icon: CircleDotIcon, label: "Claimed", iconClass: "text-foreground", badge: "bg-secondary text-secondary-foreground" },
  done: { icon: CircleCheckIcon, label: "Done", iconClass: "text-presence", badge: "bg-presence/12 text-presence" },
  cancelled: { icon: CircleSlashIcon, label: "Cancelled", iconClass: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

const ORDER: Record<View, number> = { open: 0, blocked: 1, claimed: 2, done: 3, cancelled: 4 };
const finished = (t: Task) => t.status === "done" || t.status === "cancelled";
const viewOf = (t: Task): View => (t.status === "open" && t.blocked.length ? "blocked" : t.status);
const who = (h: string) => (h === "you" ? "You" : h);

function Person({ handle }: { handle: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Jazzicon handle={handle} size={14} />
      <span className="truncate font-mono">{who(handle)}</span>
    </span>
  );
}

/** A done note clamped to six lines, and a dialog to read it all whenever the clamp cuts it at the board's width. */
function DoneNote({ task, note }: { task: Task; note: string }) {
  const text = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const el = text.current;
    if (!el) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [note]);

  return (
    <>
      <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-4 text-foreground/85">
        <span ref={text} className="line-clamp-6 break-words whitespace-pre-wrap">
          {note}
        </span>
      </code>
      {cut && <TextDialog task={task} kind="note" text={note} />}
    </>
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

function SpecFile({ file }: { file: TaskSpecFile }) {
  const { fileUrl } = useSource();
  const { ended } = useRoom().state;
  const name = file.name || "file";
  if (ended) {
    return (
      <span className="text-muted-foreground">
        <span className="font-mono break-all">{name}</span>, no longer available
      </span>
    );
  }
  return (
    <a
      href={fileUrl(file.id)}
      download={name}
      title={`Download ${name}`}
      className="inline-flex max-w-full items-center gap-1.5 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <DownloadIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 font-mono break-all">{name}</span>
      <span className="shrink-0 text-muted-foreground tabular-nums">{fmtSize(file.size)}</span>
    </a>
  );
}

const MAX_DESCRIPTION = 2000;
const MAX_REASON = 8000;
const MAX_SPEC = 20000;

export function Count({ id, text, max, raw }: { id: string; text: string; max: number; raw?: boolean }) {
  const length = raw ? text.length : text.trim().length;
  return (
    <span
      id={id}
      className={cn("text-right text-[11px] text-muted-foreground tabular-nums", length > max && "text-destructive")}
    >
      {length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
    </span>
  );
}

type TaskTextFieldsProps = {
  id: string;
  describedBy?: string;
  description: string;
  spec: string;
  disabled?: boolean;
  descriptionPlaceholder?: string;
  specPlaceholder?: string;
  onDescription: (v: string) => void;
  onSpec: (v: string) => void;
  children?: ReactNode;
};

function TaskTextFields({
  id,
  describedBy,
  description,
  spec,
  disabled,
  descriptionPlaceholder,
  specPlaceholder,
  onDescription,
  onSpec,
  children,
}: TaskTextFieldsProps) {
  return (
    <>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-description`} className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          id={`${id}-description`}
          aria-describedby={[`${id}-description-count`, describedBy].filter(Boolean).join(" ")}
          value={description}
          rows={3}
          placeholder={descriptionPlaceholder}
          disabled={disabled}
          onChange={(e) => onDescription(e.target.value)}
          className="font-normal text-foreground"
        />
        <Count id={`${id}-description-count`} text={description} max={MAX_DESCRIPTION} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-spec`} className="text-xs font-medium text-muted-foreground">
          Spec
        </label>
        <Textarea
          id={`${id}-spec`}
          aria-describedby={[`${id}-spec-count`, describedBy].filter(Boolean).join(" ")}
          value={spec}
          rows={5}
          placeholder={specPlaceholder}
          disabled={disabled}
          onChange={(e) => onSpec(e.target.value)}
          className="font-mono text-xs text-foreground md:text-xs"
        />
        <Count id={`${id}-spec-count`} text={spec} max={MAX_SPEC} />
        {children}
      </div>
    </>
  );
}

function usePostTask(path: string, onSuccess: () => void) {
  const { pollNow, endHuddle } = useRoom();
  const { post } = useSource();
  const [error, setError] = useState<ErrorInfo | null>(null);

  async function send(body: object) {
    try {
      const { r, data } = await post<{ id?: number }>(path, body);
      if (r.status === 410) {
        endHuddle();
      } else if (r.ok) {
        pollNow();
        onSuccess();
      } else {
        setError({ message: errMain(r, data), ...chipsOf(data) });
      }
    } catch {
      setError({ message: "Could not reach the server." });
    }
  }

  return { error, setError, send };
}

type TaskFormProps = {
  id: string;
  label: string;
  submitLabel: string;
  destructive?: boolean;
  error: ErrorInfo | null;
  onSubmit: () => void;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
};

function TaskForm({ id, label, submitLabel, destructive, error, onSubmit, onClose, closeLabel = "Cancel", children }: TaskFormProps) {
  return (
    <form
      autoComplete="off"
      aria-label={label}
      className="grid min-h-0 gap-3 overflow-y-auto px-0.5 py-0.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {error && <ErrorBox id={`${id}-error`} error={error} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
        <Button type="submit" size="sm" variant={destructive ? "destructive" : "default"}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Tasks that wait on this one, directly or through others; they cannot also come before it. */
function dependents(tasks: Task[], id: number) {
  const out = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (!out.has(t.id) && t.after.some((n) => n === id || out.has(n))) {
        out.add(t.id);
        grew = true;
      }
    }
  }
  return out;
}

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

function EditTask({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, live } = useRoom();
  const [base] = useState(() => ({ title: task.title, assignee: task.assignee ?? "", after: task.after, description: task.description, spec: task.spec }));
  const [title, setTitle] = useState(base.title);
  const [assignee, setAssignee] = useState(base.assignee);
  const [after, setAfter] = useState<number[]>(base.after);
  const [description, setDescription] = useState(base.description ?? "");
  const [spec, setSpec] = useState(base.spec ?? "");
  const { error, setError, send } = usePostTask(`/api/tasks/${task.id}`, onClose);
  const id = useId();
  const describedBy = error ? `${id}-error` : undefined;
  const changed =
    task.title !== base.title ||
    (task.assignee ?? "") !== base.assignee ||
    !sameList(task.after, base.after) ||
    task.description !== base.description ||
    task.spec !== base.spec;
  const handles = live.map((a) => a.handle);
  if (base.assignee && !handles.includes(base.assignee)) handles.push(base.assignee);
  const blocked = dependents(state.tasks, task.id);
  const others = state.tasks.filter((t) => t.id !== task.id);

  function submit() {
    const body: {
      title?: string;
      assignee?: string | null;
      after?: number[];
      description?: string | null;
      spec?: string | null;
    } = {};
    if (!title.trim()) return setError({ message: "Enter a title." });
    if (title.trim() !== base.title) body.title = title.trim();
    if (assignee !== base.assignee) body.assignee = assignee || null;
    const nextAfter = [...after].sort((a, b) => a - b);
    if (!sameList(nextAfter, base.after)) body.after = nextAfter;
    const nextDescription = description.trim() || null;
    const nextSpec = spec.trim() || null;
    if (nextDescription !== base.description) body.description = nextDescription;
    if (nextSpec !== base.spec) body.spec = nextSpec;
    if (!Object.keys(body).length) return onClose();
    return send(body);
  }

  return (
    <TaskForm id={id} label={`Edit task #${task.id}`} submitLabel="Save" error={error} onSubmit={submit} onClose={onClose}>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-title`} className="text-xs font-medium text-muted-foreground">
          Title
        </label>
        <Input
          id={`${id}-title`}
          aria-describedby={describedBy}
          value={title}
          maxLength={200}
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
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-full font-normal text-foreground"
        >
          <NativeSelectOption value="">Nobody</NativeSelectOption>
          {handles.map((h) => (
            <NativeSelectOption key={h} value={h}>
              {h}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <TaskTextFields
        id={id}
        describedBy={describedBy}
        description={description}
        spec={spec}
        onDescription={setDescription}
        onSpec={setSpec}
      >
        {task.specFile && <p className="text-[11px] text-muted-foreground">Typing a spec replaces the spec file.</p>}
      </TaskTextFields>
      <fieldset className="grid gap-1.5" aria-describedby={`${id}-after-help`}>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">After tasks</legend>
        {others.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">There are no other tasks yet.</p>
        ) : (
          <div className="grid max-h-32 gap-1 overflow-y-auto rounded-md border px-2 py-1.5">
            {others.map((t) => {
              const cyclic = blocked.has(t.id);
              return (
                <label
                  key={t.id}
                  className={cn("flex min-w-0 items-center gap-2 text-xs", cyclic && "text-muted-foreground")}
                >
                  <Checkbox
                    checked={after.includes(t.id)}
                    disabled={cyclic}
                    onCheckedChange={(c) => setAfter(c ? [...after, t.id] : after.filter((n) => n !== t.id))}
                  />
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">#{t.id}</span>
                  <span className="min-w-0 truncate">{t.title}</span>
                  {cyclic && <span className="shrink-0 text-[11px]">(waits on this task)</span>}
                </label>
              );
            })}
          </div>
        )}
        <p id={`${id}-after-help`} className="text-[11px] text-muted-foreground">
          This task stays blocked until the ticked tasks are done.
        </p>
      </fieldset>
      {changed && <p className="text-[11px] text-muted-foreground">This task changed since you opened it.</p>}
    </TaskForm>
  );
}

function ReopenTask({ task, onClose }: { task: Task; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const { error, setError, send } = usePostTask(`/api/tasks/${task.id}/reopen`, onClose);
  const id = useId();
  const describedBy = error ? `${id}-error` : undefined;

  function submit() {
    if (!reason.trim()) return setError({ message: "Enter a reason." });
    return send({ reason: reason.trim() });
  }

  return (
    <TaskForm id={id} label={`Reopen task #${task.id}`} submitLabel="Reopen" error={error} onSubmit={submit} onClose={onClose}>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-reason`} className="text-xs font-medium text-muted-foreground">
          Reason
        </label>
        <Textarea
          id={`${id}-reason`}
          autoFocus
          aria-describedby={[`${id}-reason-count`, describedBy].filter(Boolean).join(" ")}
          value={reason}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          className="font-normal text-foreground"
        />
        <Count id={`${id}-reason-count`} text={reason} max={MAX_REASON} />
      </div>
    </TaskForm>
  );
}

function FinishTask({ task, onClose }: { task: Task; onClose: () => void }) {
  const [note, setNote] = useState("");
  const { error, send } = usePostTask(`/api/tasks/${task.id}/done`, onClose);
  const id = useId();

  return (
    <TaskForm
      id={id}
      label={`Mark task #${task.id} done`}
      submitLabel="Mark done"
      error={error}
      onSubmit={() => send(note.trim() ? { note: note.trim() } : {})}
      onClose={onClose}
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-note`} className="text-xs font-medium text-muted-foreground">
          Done note (optional)
        </label>
        <Textarea
          id={`${id}-note`}
          autoFocus
          aria-describedby={[`${id}-note-count`, error ? `${id}-error` : ""].filter(Boolean).join(" ")}
          value={note}
          rows={3}
          placeholder="What was done, or why it is closed"
          onChange={(e) => setNote(e.target.value)}
          className="font-normal text-foreground"
        />
        <Count id={`${id}-note-count`} text={note} max={MAX_REASON} />
      </div>
    </TaskForm>
  );
}

function ReassignTask({ task, onClose }: { task: Task; onClose: () => void }) {
  const { live } = useRoom();
  const [assignee, setAssignee] = useState(task.owner ?? task.assignee ?? "");
  const { error, send } = usePostTask(`/api/tasks/${task.id}/assign`, onClose);
  const id = useId();
  const handles = live.map((a) => a.handle);

  return (
    <TaskForm
      id={id}
      label={`Reassign task #${task.id}`}
      submitLabel="Reassign"
      error={error}
      onSubmit={() => send({ assignee: assignee || null })}
      onClose={onClose}
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-assignee`} className="text-xs font-medium text-muted-foreground">
          Assign to
        </label>
        <NativeSelect
          id={`${id}-assignee`}
          autoFocus
          aria-describedby={error ? `${id}-error` : undefined}
          value={handles.includes(assignee) ? assignee : ""}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-full font-normal text-foreground"
        >
          <NativeSelectOption value="">Nobody</NativeSelectOption>
          {handles.map((h) => (
            <NativeSelectOption key={h} value={h}>
              {h}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </TaskForm>
  );
}

function CancelTask({ task, onClose }: { task: Task; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const { error, send } = usePostTask(`/api/tasks/${task.id}/cancel`, onClose);
  const id = useId();

  return (
    <TaskForm
      id={id}
      label={`Cancel task #${task.id}`}
      submitLabel="Cancel task"
      destructive
      closeLabel="Keep task"
      error={error}
      onSubmit={() => send(reason.trim() ? { reason: reason.trim() } : {})}
      onClose={onClose}
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-reason`} className="text-xs font-medium text-muted-foreground">
          Reason (optional)
        </label>
        <Textarea
          id={`${id}-reason`}
          autoFocus
          aria-describedby={[`${id}-reason-count`, error ? `${id}-error` : ""].filter(Boolean).join(" ")}
          value={reason}
          rows={3}
          placeholder="Why it is no longer needed"
          onChange={(e) => setReason(e.target.value)}
          className="font-normal text-foreground"
        />
        <Count id={`${id}-reason-count`} text={reason} max={MAX_REASON} />
      </div>
    </TaskForm>
  );
}

/** Who a cancel tells: the holder or assignee, the creator, and whoever has a task after it. */
function cancelTold(tasks: Task[], task: Task) {
  const after = tasks.filter((t) => !finished(t) && t.after.includes(task.id)).map((t) => t.owner ?? t.assignee);
  return [...new Set([task.owner ?? task.assignee, task.createdBy, ...after])].filter((h): h is string => !!h && h !== "you");
}

type Mode = "edit" | "reopen" | "done" | "reassign" | "cancel";

const DIALOG: Record<Mode, { title: (n: number) => string; describe: (t: Task) => string }> = {
  edit: { title: (n) => `Edit task #${n}`, describe: () => "The assignee or owner is told what changed." },
  reopen: {
    title: (n) => `Reopen task #${n}`,
    describe: (t) => (t.status === "cancelled" ? "It is open again for its assignee, who is told why." : "The owner is told why it is open again."),
  },
  done: {
    title: (n) => `Mark task #${n} done`,
    describe: (t) => `It counts as done by you.${t.owner ? ` @${t.owner} holds it and is told.` : t.assignee ? ` @${t.assignee} is told.` : ""}`,
  },
  reassign: {
    title: (n) => `Reassign task #${n}`,
    describe: (t) =>
      t.owner
        ? `@${t.owner} holds it. Moving it to someone else releases it and tells them; the new assignee is woken with the task.`
        : "The new assignee is woken with the task.",
  },
  cancel: {
    title: (n) => `Cancel task #${n}`,
    describe: () => "It counts as finished, so tasks waiting only on it can start. It keeps its number, and Reopen brings it back.",
  },
};

/** Edit, Reopen and the status actions open in one dialog; a done or cancelled task cannot be edited, so it only offers Reopen. */
function TaskActions({ task }: { task: Task }) {
  const { tasks } = useRoom().state;
  const done = finished(task);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const status = useRef<HTMLButtonElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const release = usePostTask(`/api/tasks/${task.id}/release`, () => {});
  const close = () => setOpen(false);
  const show = (m: Mode) => {
    setMode(m);
    setOpen(true);
  };
  const Form = { edit: EditTask, reopen: ReopenTask, done: FinishTask, reassign: ReassignTask, cancel: CancelTask }[mode];

  const wasDone = useRef(done);
  useEffect(() => {
    setOpen(false);
    // Marking it done or cancelled removes the Status button that had focus; Reopen takes its place.
    if (done && !wasDone.current && document.activeElement === document.body) edit.current?.focus();
    wasDone.current = done;
  }, [done]);

  const blockedBy = task.blocked.map((n) => `#${n}`).join(", ");
  const told = mode === "cancel" ? cancelTold(tasks, task) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center justify-end gap-2 px-3 pb-2.5">
        {done && <p className="min-w-0 text-[11px] text-muted-foreground">A {task.status} task cannot be edited. Reopen it first.</p>}
        {!done && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button ref={status} type="button" variant="ghost" size="sm" className="shrink-0" aria-label={`Change status of task #${task.id}`}>
                Status
                <ChevronDownIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled={!!task.blocked.length} onSelect={() => show("done")}>
                <CircleCheckIcon aria-hidden />
                <span className="grid">
                  Mark done…
                  {!!task.blocked.length && <span className="text-[11px] text-muted-foreground">Waits on {blockedBy}; finish that first</span>}
                </span>
              </DropdownMenuItem>
              {task.status === "claimed" && (
                <DropdownMenuItem onSelect={() => release.send({})}>
                  <UndoIcon aria-hidden />
                  Unclaim from {task.owner}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => show("reassign")}>
                <UserRoundIcon aria-hidden />
                Reassign…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => show("cancel")}>
                <CircleSlashIcon aria-hidden />
                Cancel task…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          ref={edit}
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-label={`${done ? "Reopen" : "Edit"} task #${task.id}`}
          onClick={() => show(done ? "reopen" : "edit")}
        >
          {done ? "Reopen" : "Edit"}
        </Button>
      </div>
      {release.error && <ErrorBox error={release.error} onDismiss={() => release.setError(null)} className="mx-3 mb-2.5" />}
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-lg"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          (mode === "edit" || mode === "reopen" ? edit.current : (status.current ?? edit.current))?.focus();
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="leading-snug break-words">
            {DIALOG[mode].title(task.id)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {DIALOG[mode].describe(task)}
            {told.length > 0 && ` ${told.map((h) => `@${h}`).join(", ")} ${told.length > 1 ? "are" : "is"} told.`}
          </DialogDescription>
        </DialogHeader>
        <Form task={task} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

/** The full text of a long spec or done note, read in a dialog instead of stretching the card. */
function TextDialog({ task, kind, text, intro }: { task: Task; kind: "spec" | "note"; text: string; intro?: string | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto justify-start px-0 text-[11px]" aria-label={`Read the ${kind} for task #${task.id}`}>
          Read {kind}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="leading-snug break-words">
            #{task.id} {task.title}
          </DialogTitle>
          <DialogDescription className="text-xs">{text.length.toLocaleString("en-US")} characters</DialogDescription>
        </DialogHeader>
        {intro && <p className="text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">{intro}</p>}
        <div
          tabIndex={0}
          role="region"
          aria-label={`${kind === "spec" ? "Spec" : "Done note"} for task #${task.id}`}
          className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted px-3 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {text}
        </div>
        <div className="flex justify-end">
          <CopyButton text={text} label={`Copy ${kind}`} icon={<CopyIcon aria-hidden />} variant="outline" size="sm" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[viewOf(task)] ?? STATUS.open;
  const Icon = status.icon;
  const done = finished(task);
  const { ended, agents } = useRoom().state;
  const trigger = useRef<HTMLButtonElement>(null);
  const ownerAsleep = !!task.owner && !!agents.find((a) => a.handle === task.owner)?.asleepHolding?.includes(task.id);

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
    >
      <li className={cn("rounded-lg border bg-background/60 transition-colors", done && "bg-transparent", open && "bg-background")}>
        <CollapsibleTrigger
          ref={trigger}
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
              <span className="sr-only">{`, owned by ${who(task.owner)}${ownerAsleep ? ", asleep" : ""}, `}</span>
            </>
          )}
          {ownerAsleep && (
            <MoonIcon aria-hidden className="size-3.5 shrink-0 text-signal" />
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
            {task.description && (
              <Row label="Description">
                <span className="break-words whitespace-pre-wrap">{task.description}</span>
              </Row>
            )}
            {task.spec && (
              <Row label="Spec">
                <div className="rounded-md bg-muted px-2 py-1.5 text-foreground/85">
                  <p className="line-clamp-6 break-words whitespace-pre-wrap">{task.spec}</p>
                </div>
                <TextDialog task={task} kind="spec" text={task.spec} intro={task.description} />
              </Row>
            )}
            {task.specFile && (
              <Row label="Spec file">
                <SpecFile file={task.specFile} />
              </Row>
            )}
            {!!task.after.length && (
              <Row label="After">
                {task.after.map((n) => `#${n}${task.blocked.includes(n) ? " (not done)" : ""}`).join(", ")}
              </Row>
            )}
            <Row label="Owner">
              {task.owner ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Person handle={task.owner} />
                  {ownerAsleep && <span className="shrink-0 text-signal">asleep</span>}
                </span>
              ) : (
                "Unclaimed"
              )}
            </Row>
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
              <Row label={task.status === "done" || !task.reopened ? "Done note" : "Last done note"}>
                <DoneNote task={task} note={task.note} />
              </Row>
            )}
            {task.cancelled && (
              <Row label="Cancelled by">
                <span className="grid min-w-0 gap-0.5">
                  <Person handle={task.cancelled.by} />
                  {task.cancelled.reason && <span className="break-words whitespace-pre-wrap">{task.cancelled.reason}</span>}
                </span>
              </Row>
            )}
            {task.reopened && (
              <Row label="Reopened by">
                <span className="grid min-w-0 gap-0.5">
                  <Person handle={task.reopened.by} />
                  <span className="break-words whitespace-pre-wrap">{task.reopened.reason}</span>
                </span>
              </Row>
            )}
          </dl>
          {!ended && <TaskActions task={task} />}
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
  const [description, setDescription] = useState("");
  const [spec, setSpec] = useState("");
  const [after, setAfter] = useState("");
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
    const body: { title: string; assignee?: string; description?: string; spec?: string; after?: number[] } = { title: t };
    const tokens = after.split(/[\s,]+/).filter(Boolean);
    if (!tokens.every((x) => /^#?\d+$/.test(x))) {
      return setError({ message: "Use task numbers separated by commas, like 1, 2, 3." });
    }
    if (tokens.length) body.after = tokens.map((x) => Number(x.replace("#", "")));
    if (current) body.assignee = current;
    if (description.trim()) body.description = description.trim();
    if (spec.trim()) body.spec = spec.trim();
    try {
      const { r, data } = await post<{ id?: number }>("/api/tasks", body);
      if (r.status === 410) {
        endHuddle();
      } else if (r.ok) {
        setTitle("");
        setDescription("");
        setSpec("");
        setAfter("");
        setError(null);
        setOk(data?.id ? `Added task #${data.id}` : "Task added");
        clearTimeout(okTimer.current);
        okTimer.current = setTimeout(() => setOk(""), 2500);
        titleRef.current?.focus();
        pollNow();
      } else {
        setError({ message: errMain(r, data), ...chipsOf(data) });
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
          <TaskTextFields
            id={id}
            describedBy={describedBy}
            description={description}
            spec={spec}
            disabled={state.ended}
            descriptionPlaceholder="Optional context for whoever takes it"
            specPlaceholder="Optional detailed requirements"
            onDescription={setDescription}
            onSpec={setSpec}
          />
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-after`} className="text-xs font-medium text-muted-foreground">
              After tasks
            </label>
            <Input
              id={`${id}-after`}
              aria-describedby={[`${id}-after-help`, describedBy].filter(Boolean).join(" ")}
              value={after}
              placeholder="e.g. 1, 2, 3"
              disabled={state.ended}
              onChange={(e) => setAfter(e.target.value)}
              className="font-normal text-foreground"
            />
            <p id={`${id}-after-help`} className="text-[11px] text-muted-foreground">
              This task stays blocked until those are done.
            </p>
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
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const sorted = tasks.slice().sort((a, b) => (ORDER[viewOf(a)] ?? 4) - (ORDER[viewOf(b)] ?? 4) || a.id - b.id);
  const roving = useRovingFocus<HTMLUListElement>();

  return (
    <section aria-labelledby="tasks-h" className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="tasks-h" className="text-xs font-medium text-muted-foreground">
          Tasks
        </h3>
        {tasks.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {done}/{tasks.length - cancelled} done
            {cancelled > 0 && ` · ${cancelled} cancelled`}
          </span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
          {state.ended ? "No tasks in this room." : "No tasks yet. Agents add them as they split the work, or add one yourself."}
        </p>
      ) : (
        <ul {...roving} className="mt-2 flex flex-col gap-1.5">
          {sorted.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </ul>
      )}
      {!state.ended && <NewTask />}
    </section>
  );
}
