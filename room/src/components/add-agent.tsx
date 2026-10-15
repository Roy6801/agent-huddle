import { UserPlusIcon } from "lucide-react";
import { useId, useState } from "react";

import { CommandLine, JoinLines } from "@/components/join-lines";
import { Button } from "@/components/ui/button";
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
import { useRoom } from "@/hooks/use-room";
import { cn } from "@/lib/utils";

const FALLBACK_HARNESSES: readonly (readonly [string, string])[] = [
  ["claude", "Claude Code"],
  ["codex", "Codex"],
  ["gemini", "Gemini CLI"],
  ["opencode", "opencode"],
];

type Mode = "terminal" | "headless";

const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;

export function workerCommand(worker: string, harness: string, joinUrl: string, folder: string) {
  const dir = folder.trim();
  return `node ${quote(worker)} worker ${harness} ${quote(joinUrl)}${dir ? ` --dir ${quote(dir)}` : ""}`;
}

function Headless({ joinUrl }: { joinUrl: string }) {
  const { state } = useRoom();
  const harnesses = state.harnesses ?? FALLBACK_HARNESSES;
  const [harness, setHarness] = useState<string>(harnesses[0][0]);
  const [edited, setEdited] = useState<string | null>(null);
  const folder = edited ?? state.folder ?? "";
  const id = useId();

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        The agent runs with no chat window, on your own sign-in for that harness, and wakes when someone @mentions it.
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
      <CommandLine text={workerCommand(state.worker ?? "huddle.mjs", harness, joinUrl, folder)} label="Copy" />
      <p className="text-xs text-muted-foreground">
        Run this in a terminal. The agent works in that folder and asks you here before risky actions. Ctrl-C stops it.
      </p>
    </div>
  );
}

export function AddAgent() {
  const { state } = useRoom();
  const { joinUrl, ended } = state;
  const [mode, setMode] = useState<Mode>("terminal");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
          <DialogDescription>Bring another agent into this huddle.</DialogDescription>
        </DialogHeader>
        <fieldset className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <legend className="sr-only">How the agent runs</legend>
          {(
            [
              ["terminal", "In my terminal"],
              ["headless", "Headless"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={cn(
                "flex min-h-8 cursor-pointer items-center justify-center rounded-md px-2 text-sm font-medium text-muted-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 max-md:min-h-11",
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
            </label>
          ))}
        </fieldset>
        {mode === "terminal" ? <JoinLines joinUrl={joinUrl} /> : <Headless joinUrl={joinUrl} />}
      </DialogContent>
    </Dialog>
  );
}
