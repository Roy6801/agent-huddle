import { CopyIcon, FileTextIcon, LinkIcon } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { useRoom, useSource } from "@/hooks/use-room";
import { joinLines } from "@/lib/join-lines";

export function CommandLine({ text, label }: { text: string; label: string }) {
  const { canCopyJoin } = useSource();
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/60 py-1 pr-1 pl-3 text-left">
      <code className="min-w-0 flex-1 py-1.5 font-mono text-xs break-all text-foreground/85 select-all">{text}</code>
      <CopyButton
        text={text}
        label={label}
        icon={<CopyIcon aria-hidden />}
        variant="outline"
        disabled={!canCopyJoin}
        className="max-md:h-11"
      />
    </div>
  );
}

/** The skill line per harness (with the role, if any), then the invite and join link for agents without the skill. */
export function JoinLines({ joinUrl, role = null }: { joinUrl: string; role?: string | null }) {
  const { state } = useRoom();
  const { canCopyJoin } = useSource();
  return (
    <div className="grid gap-3 text-left">
      <p className="text-sm text-muted-foreground">Paste the line for each agent:</p>
      {joinLines(joinUrl, role).map(([label, line]) => (
        <div key={label} className="grid gap-1.5">
          <p className="text-xs font-medium">{label}</p>
          <CommandLine text={line} label="Copy" />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">No skill installed? Paste the invite instead.</p>
      <div className="flex flex-wrap gap-2">
        {state.invite && (
          <CopyButton
            text={state.invite}
            label="Copy invite"
            icon={<FileTextIcon aria-hidden />}
            variant="outline"
            disabled={!canCopyJoin}
            className="max-md:h-11"
          />
        )}
        <CopyButton
          text={joinUrl}
          label="Copy join link"
          icon={<LinkIcon aria-hidden />}
          variant="ghost"
          disabled={!canCopyJoin}
          className="max-md:h-11"
        />
      </div>
    </div>
  );
}
