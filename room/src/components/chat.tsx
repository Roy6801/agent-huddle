import { PaperclipIcon } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { Composer } from "@/components/composer";
import type { ErrorInfo } from "@/components/error-box";
import { Feed, type FeedHandle } from "@/components/feed";
import { useAttachments } from "@/hooks/use-attachments";
import { useRoom, useSource } from "@/hooks/use-room";

const hasFiles = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

/** Feed, invite and composer; the whole column accepts dropped files. */
export function Chat() {
  const { state, identities, announce, endHuddle } = useRoom();
  const { upload } = useSource();
  const { ended, loaded, agents, joinUrl, messages } = state;
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const feed = useRef<FeedHandle>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const attachments = useAttachments({
    onError: (message) => setError({ message }),
    onEnded: endHuddle,
    announce,
    upload,
  });
  const { add, clear } = attachments;

  useEffect(() => {
    if (!ended) return;
    clear();
    setError(null);
    setDragging(false);
  }, [ended, clear]);

  // A file dropped anywhere else must not navigate away from the room.
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const inviteUrl = !ended && loaded && agents.length === 0 && joinUrl ? joinUrl : null;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(e: DragEvent) => {
        if (!hasFiles(e) || ended) return;
        e.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e: DragEvent) => {
        if (!hasFiles(e) || ended) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (depth.current && --depth.current === 0) setDragging(false);
      }}
      onDrop={(e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (ended) return;
        add(e.dataTransfer.files, false);
        textRef.current?.focus();
      }}
    >
      <Feed ref={feed} messages={messages} identities={identities} inviteUrl={inviteUrl} />
      <Composer
        attachments={attachments}
        error={error}
        setError={setError}
        textRef={textRef}
        onSent={() => feed.current?.toBottom()}
      />
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-xl border-[1.5px] border-dashed border-signal bg-signal/10 font-medium text-signal backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in">
          <div className="grid justify-items-center gap-2 text-center">
            <PaperclipIcon aria-hidden className="size-6" />
            Drop files to attach
            <small className="text-[12.5px] font-normal text-muted-foreground">
              They upload now and send with your next message.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
