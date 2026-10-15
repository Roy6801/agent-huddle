import { FolderIcon } from "lucide-react";
import { useState } from "react";

import { SettingsEditor } from "@/components/minutes-settings";
import { useRoom } from "@/hooks/use-room";

/** The folder agents work in, shown in full, and a form that moves the room to another one. */
export function RoomFolder() {
  const { folder } = useRoom().state;
  const [value, setValue] = useState("");

  function toBody() {
    const path = value.trim();
    return path.startsWith("/") ? { folder: path } : "Enter the full path, starting with /.";
  }

  return (
    <SettingsEditor
      id="folder"
      title="Room folder"
      noun="room folder"
      icon={FolderIcon}
      alignStart
      summary={<span className="min-w-0 font-mono break-all">{folder || "None set"}</span>}
      onOpen={() => setValue(folder ?? "")}
      toBody={toBody}
    >
      {(errorId) => (
        <div className="grid gap-1.5">
          <label htmlFor="folder-path" className="text-xs text-foreground/80">
            Folder (full path)
          </label>
          <input
            id="folder-path"
            type="text"
            spellCheck={false}
            aria-invalid={!!errorId || undefined}
            aria-describedby={errorId ? `${errorId} folder-help` : "folder-help"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <p id="folder-help" className="text-[11px] text-muted-foreground">
            Every agent is told, and a task to move the files goes to the lead.
          </p>
        </div>
      )}
    </SettingsEditor>
  );
}
