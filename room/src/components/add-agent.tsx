import { ChevronRightIcon, CopyIcon, PlayIcon, UserPlusIcon } from "lucide-react";
import { useId, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { CommandLine, JoinLines } from "@/components/join-lines";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useRoom, useSource } from "@/hooks/use-room";
import { errMain } from "@/lib/api";
import { validRole } from "@/lib/join-lines";
import type { StartedWorker } from "@/lib/types";
import { cn } from "@/lib/utils";

const FALLBACK_HARNESSES: readonly (readonly [string, string])[] = [
  ["claude", "Claude Code"],
  ["codex", "Codex"],
  ["gemini", "Gemini CLI"],
  ["opencode", "opencode"],
];

type Mode = "terminal" | "headless";

const MODES: readonly (readonly [Mode, string, string])[] = [
  ["terminal", "In my terminal", "You watch and steer it"],
  ["headless", "Headless", "Runs in the background"],
];

const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;

export function workerCommand(worker: string, harness: string, joinUrl: string, folder: string, role: string | null = null) {
  const dir = folder.trim();
  return `node ${quote(worker)} worker ${harness} ${quote(joinUrl)}${dir ? ` --dir ${quote(dir)}` : ""}${role ? ` --role ${role}` : ""}`;
}

function RoleField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const invalid = value !== "" && !validRole(value);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        Role <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Input
        id={id}
        className="font-mono max-md:h-11"
        value={value}
        placeholder="builder"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value.trim().toLowerCase())}
      />
      <p id={`${id}-hint`} className={cn("text-xs text-muted-foreground", invalid && "text-destructive")}>
        {invalid
          ? "Use up to 20 lowercase letters, digits or dashes; not all, you, system or headless."
          : "The agent joins with it, so @role reaches it."}
      </p>
    </div>
  );
}

const STATUS: Record<StartedWorker["status"], string> = {
  starting: "Starting",
  running: "Running",
  stopping: "Stopping",
  stopped: "Stopped",
  failed: "Failed",
};

function WorkerRow({ worker }: { worker: StartedWorker }) {
  const { state, pollNow } = useRoom();
  const { post } = useSource();
  const [error, setError] = useState("");
  const live = worker.status === "starting" || worker.status === "running";
  const who = worker.handle ?? worker.label;

  async function stop() {
    setError("");
    try {
      const { r, data } = await post(`/api/workers/${worker.id}/stop`, {});
      if (!r.ok) return setError(errMain(r, data));
      pollNow();
    } catch {
      setError("Could not reach the room server.");
    }
  }

  return (
    <li className="grid gap-1.5 rounded-lg border p-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium">{worker.handle ? `@${worker.handle}` : worker.label}</span>
        <span className={cn("text-muted-foreground", worker.status === "failed" && "text-destructive")}>{STATUS[worker.status]}</span>
        {live && (
          <Button
            variant="outline"
            size="xs"
            disabled={state.ended}
            onClick={stop}
            aria-label={`Stop ${who}`}
            className="ml-auto border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive max-md:h-11"
          >
            Stop
          </Button>
        )}
      </div>
      {worker.error && <p className="break-words text-destructive">{worker.error}</p>}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Log</span>
        <code className="min-w-0 flex-1 font-mono break-all text-foreground/85 select-all">{worker.log}</code>
        <CopyButton text={worker.log} label="Copy" aria-label={`Copy the log path of ${who}`} icon={<CopyIcon aria-hidden />} variant="ghost" size="xs" className="max-md:h-11" />
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

function Headless({ joinUrl, role }: { joinUrl: string; role: string | null }) {
  const { state, pollNow } = useRoom();
  const { post, canCopyJoin } = useSource();
  const harnesses = state.harnesses ?? FALLBACK_HARNESSES;
  const [harness, setHarness] = useState<string>(harnesses[0][0]);
  const [edited, setEdited] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const folder = edited ?? state.folder ?? "";
  const label = harnesses.find(([value]) => value === harness)?.[1] ?? harness;
  const id = useId();

  async function start() {
    setError("");
    setStarting(true);
    try {
      const { r, data } = await post("/api/workers", { harness, folder: folder.trim() || undefined, role: role ?? undefined });
      // A worker that failed while starting shows its own error in its row below.
      if (!r.ok) setError(data?.error === "worker_failed" ? (data.instruction ?? "") : [errMain(r, data), data?.instruction].filter(Boolean).join(" "));
      pollNow();
    } catch {
      setError("Could not reach the room server.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        The agent runs in the background with no chat window, on your own sign-in for that harness. It wakes when someone
        @mentions it, and its approvals come to this page.
      </p>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-harness`} className="text-xs font-medium">
          Harness
        </label>
        <NativeSelect className="w-full" id={`${id}-harness`} value={harness} onChange={(e) => setHarness(e.target.value)}>
          {harnesses.map(([value, name]) => (
            <NativeSelectOption key={value} value={value}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-folder`} className="text-xs font-medium">
          Folder
        </label>
        <Input
          id={`${id}-folder`}
          className="font-mono max-md:h-11"
          value={folder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setEdited(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Button onClick={start} disabled={starting || state.ended || !canCopyJoin} className="max-md:h-11">
          <PlayIcon aria-hidden />
          {starting ? `Starting ${label}…` : `Start ${label}`}
        </Button>
        <p className="text-xs text-muted-foreground">
          It starts on this machine as you, works in that folder and asks you here before risky actions.
        </p>
        {error && (
          <p role="alert" className="text-xs break-words text-destructive">
            {error}
          </p>
        )}
      </div>
      {state.workers.length > 0 && (
        <section aria-label="Started from this page" className="grid gap-1.5">
          <h3 className="text-xs font-medium">Started from this page</h3>
          <ul className="grid gap-1.5">
            {state.workers.map((w) => (
              <WorkerRow key={w.id} worker={w} />
            ))}
          </ul>
        </section>
      )}
      <Collapsible>
        <CollapsibleTrigger className="group/cmd -ml-1 inline-flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 max-md:min-h-11">
          <ChevronRightIcon aria-hidden className="size-3.5 transition-transform group-data-[state=open]/cmd:rotate-90" />
          Or run it yourself in a terminal
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1.5 grid gap-1.5">
          <CommandLine text={workerCommand(state.worker ?? "huddle.mjs", harness, joinUrl, folder, role)} name="Copy the headless command" />
          <p className="text-xs text-muted-foreground">Its output stays in that terminal. Stop it from its row in the roster, or with Ctrl-C.</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function AddAgent() {
  const { state } = useRoom();
  const { joinUrl, ended } = state;
  const [mode, setMode] = useState<Mode>("terminal");
  const [roleText, setRoleText] = useState("");
  const role = validRole(roleText) ? roleText : null;
  const name = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Add agent"
          disabled={ended || !joinUrl}
          className="max-md:size-11 max-md:border-transparent max-md:bg-transparent max-md:px-0 max-md:dark:border-transparent max-md:dark:bg-transparent"
        >
          <UserPlusIcon aria-hidden />
          <span className="sr-only md:@xl:not-sr-only">Add agent</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
          <DialogDescription>Bring another agent into this huddle, in its own terminal or headless.</DialogDescription>
        </DialogHeader>
        <fieldset className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <legend className="sr-only">How the agent runs</legend>
          {MODES.map(([value, text, hint]) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-md px-2 py-1.5 text-center text-sm font-medium text-muted-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                mode === value && "bg-background text-foreground shadow-sm",
              )}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={mode === value}
                tabIndex={mode === value ? 0 : -1}
                onChange={() => setMode(value)}
                className="sr-only"
              />
              {text}
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
            </label>
          ))}
        </fieldset>
        <RoleField value={roleText} onChange={setRoleText} />
        {mode === "terminal" ? <JoinLines joinUrl={joinUrl} role={role} /> : <Headless joinUrl={joinUrl} role={role} />}
      </DialogContent>
    </Dialog>
  );
}
