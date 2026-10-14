import { ArrowUpIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import { ErrorBox, type ErrorInfo } from "@/components/error-box";
import { FileTypeIcon } from "@/components/files";
import { GroupAvatar, Jazzicon } from "@/components/identity";
import { Button } from "@/components/ui/button";
import type { useAttachments } from "@/hooks/use-attachments";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoom } from "@/hooks/use-room";
import { errMain, postJson, validOf } from "@/lib/api";
import { fmtSize } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_TEXT_H = 190;
const DEFAULT_PLACEHOLDER = "Message the room. Type @ to mention.";

type Candidate = { v: string; d: string; who?: string };
type Attachments = ReturnType<typeof useAttachments>;

export function Composer({
  attachments,
  error,
  setError,
  textRef,
  onSent,
}: {
  attachments: Attachments;
  error: ErrorInfo | null;
  setError: (e: ErrorInfo | null) => void;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onSent: () => void;
}) {
  const { state, live, atCap, pollNow, endHuddle } = useRoom();
  const { ended, agents } = state;
  const { atts, current, add, remove, drop } = attachments;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [ac, setAc] = useState<{ items: Candidate[]; index: number; range: [number, number] } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const acList = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const ta = textRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXT_H)}px`;
  }, [text, textRef]);

  useLayoutEffect(() => {
    acList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [ac?.index]);

  function candidates(): Candidate[] {
    const out: Candidate[] = [];
    const parents = new Set(agents.map((a) => a.parent).filter(Boolean));
    for (const a of live) {
      out.push({ v: a.handle, d: a.role || a.harness || "", who: a.handle });
      if (parents.has(a.handle)) out.push({ v: `${a.handle}.*`, d: "it and its children", who: a.handle });
    }
    for (const r of new Set(live.map((a) => a.role).filter((r): r is string => !!r))) out.push({ v: r, d: "role" });
    out.push({ v: "all", d: "every agent" });
    return out;
  }

  function updateAc(value: string, pos: number, keepIndex = false) {
    const m = /(^|\s)@([\w.*-]*)$/.exec(value.slice(0, pos));
    if (!m) return setAc(null);
    const q = m[2].toLowerCase();
    const items = candidates()
      .filter((c) => c.v.toLowerCase().startsWith(q))
      .slice(0, 30);
    if (!items.length) return setAc(null);
    const index = keepIndex && ac ? Math.min(ac.index, items.length - 1) : 0;
    setAc({ items, index, range: [pos - m[2].length - 1, pos] });
  }

  function pick(i: number) {
    const c = ac?.items[i];
    const ta = textRef.current;
    if (!c || !ac || !ta) return;
    const ins = `@${c.v} `;
    const next = text.slice(0, ac.range[0]) + ins + text.slice(ac.range[1]);
    const p = ac.range[0] + ins.length;
    setText(next);
    setAc(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(p, p);
    });
  }

  const canSend = !ended && !sending && (!!text.trim() || atts.length > 0);

  async function submit() {
    const v = text.trim();
    if ((!v && !atts.length) || sending || ended) return;
    setSending(true);
    try {
      await Promise.all(current.current.map((a) => a.promise));
      const sent = current.current.filter((a) => a.state === "done");
      if (!v && !sent.length) return;
      const body: { text: string; files?: string[] } = { text: v };
      if (sent.length) body.files = sent.map((a) => a.id!);
      const { r, data } = await postJson("/api/post", body);
      if (r.status === 410) {
        endHuddle();
      } else if (r.ok) {
        setText("");
        sent.forEach(drop);
        setError(null);
        setAc(null);
        pollNow();
        setTimeout(onSent, 150);
      } else {
        setError({ message: errMain(r, data), valid: validOf(data), validLabel: "Valid mentions" });
      }
    } catch {
      setError({ message: "Could not reach the server. Your text is kept; try again." });
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  }

  const narrow = useIsMobile();
  const placeholder = ended
    ? "This room has ended."
    : atCap
      ? narrow
        ? "Agents are waiting on you"
        : "Agents are waiting on you. Reply to let them continue."
      : DEFAULT_PLACEHOLDER;

  return (
    <form
      autoComplete="off"
      className="shrink-0 bg-background pt-2 pb-3 sm:pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        {error && (
          <ErrorBox
            error={error}
            className="mb-2"
            onDismiss={() => {
              setError(null);
              textRef.current?.focus();
            }}
          />
        )}
        {atts.length > 0 && (
          <ul aria-label="Attached files" className="mb-2 flex flex-wrap gap-1.5">
            {atts.map((att) => (
              <li
                key={att.key}
                title={`${att.name} (${fmtSize(att.file.size)})`}
                className="relative inline-flex h-10 max-w-full items-center gap-2 overflow-hidden rounded-lg border bg-muted/60 pr-0.5 pl-1"
              >
                {att.preview ? (
                  <img src={att.preview} alt="" className="size-[30px] shrink-0 rounded-md bg-muted object-cover" />
                ) : (
                  <FileTypeIcon type={att.file.type} name={att.name} className="size-[30px] bg-background" />
                )}
                <span className="max-w-32 truncate text-xs font-medium sm:max-w-44">{att.name}</span>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap tabular-nums",
                    att.state === "done" ? "text-muted-foreground" : "text-signal",
                  )}
                >
                  {att.state === "done" ? fmtSize(att.size ?? att.file.size) : att.pct === null ? "Uploading" : `${att.pct}%`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${att.name}`}
                  onClick={() => {
                    remove(att);
                    textRef.current?.focus();
                  }}
                >
                  <XIcon aria-hidden />
                </Button>
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-0 left-0 h-0.5 bg-signal transition-[width,opacity] duration-150",
                    att.state === "done" && "opacity-0 duration-300",
                  )}
                  style={{ width: `${att.pct ?? 0}%` }}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          {ac && (
            <ul
              ref={acList}
              id="mention-list"
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 max-h-66 w-full max-w-sm min-w-64 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
            >
              {ac.items.map((c, i) => (
                <li
                  key={c.v}
                  id={`mention-${i}`}
                  role="option"
                  aria-selected={i === ac.index}
                  className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 aria-selected:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(i);
                  }}
                  onMouseMove={() => {
                    if (ac.index !== i) setAc({ ...ac, index: i });
                  }}
                >
                  {c.who ? <Jazzicon handle={c.who} size={20} /> : <GroupAvatar size={20} />}
                  <span className="font-mono text-[13px] whitespace-nowrap">@{c.v}</span>
                  <small className="ml-auto truncate pl-3 text-xs text-muted-foreground">{c.d}</small>
                </li>
              ))}
            </ul>
          )}
          <div
            className={cn(
              "flex items-end gap-1 rounded-xl border border-input bg-background p-1 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25 dark:bg-input/20",
              ended && "bg-muted shadow-none",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="text-muted-foreground"
              aria-label="Attach files"
              title="Attach files"
              disabled={ended}
              onClick={() => picker.current?.click()}
            >
              <PaperclipIcon aria-hidden className="size-[18px]" />
            </Button>
            <input
              ref={picker}
              type="file"
              multiple
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) add(e.target.files, false);
                e.target.value = "";
                textRef.current?.focus();
              }}
            />
            <label htmlFor="composer-text" className="sr-only">
              Message
            </label>
            <textarea
              ref={textRef}
              id="composer-text"
              rows={1}
              value={text}
              disabled={ended}
              placeholder={placeholder}
              aria-autocomplete="list"
              aria-controls={ac ? "mention-list" : undefined}
              aria-activedescendant={ac ? `mention-${ac.index}` : undefined}
              aria-describedby="composer-hint"
              className="max-h-[190px] min-h-9 min-w-0 flex-1 resize-none self-center bg-transparent py-[7px] text-sm leading-[22px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              onChange={(e) => {
                setText(e.target.value);
                updateAc(e.target.value, e.target.selectionStart);
              }}
              onClick={(e) => updateAc(e.currentTarget.value, e.currentTarget.selectionStart, true)}
              onBlur={() => setTimeout(() => setAc(null), 100)}
              onPaste={(e) => {
                const cd = e.clipboardData;
                if (!cd || !cd.files || !cd.files.length || cd.getData("text/plain")) return;
                e.preventDefault();
                if (!ended) add(cd.files, true);
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (ac && ac.items.length) {
                  const n = ac.items.length;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    return setAc({ ...ac, index: (ac.index + 1) % n });
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    return setAc({ ...ac, index: (ac.index - 1 + n) % n });
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    return pick(ac.index);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    return setAc(null);
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label="Send"
              disabled={!canSend}
              className="bg-signal text-signal-foreground hover:bg-signal/90"
            >
              <ArrowUpIcon aria-hidden className="size-[18px]" />
            </Button>
          </div>
        </div>
        <p id="composer-hint" className={cn("mt-2 ml-0.5 hidden text-xs text-muted-foreground sm:block", ended && "sm:hidden")}>
          Enter to send · Shift+Enter for a new line · no mention = everyone · drop or paste files to attach
        </p>
      </div>
    </form>
  );
}
