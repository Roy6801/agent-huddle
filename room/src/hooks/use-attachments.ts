import { useCallback, useLayoutEffect, useReducer, useRef } from "react";

import { base } from "@/lib/api";
import { fmtSize, INLINE_TYPES } from "@/lib/format";

export const MAX_ATTACH = 10;

export type Att = {
  key: number;
  file: File;
  name: string;
  state: "uploading" | "done" | "error";
  pct: number | null;
  id?: string;
  size?: number;
  preview?: string;
  xhr?: XMLHttpRequest;
  promise?: Promise<void>;
  removed?: boolean;
};

type Callbacks = {
  onError: (message: string) => void;
  onEnded: () => void;
  announce: (message: string) => void;
};

function uploadError(att: Att, status: number, data: { error?: string; limit?: number } | null) {
  if (status === 413) {
    const limit = data?.limit ? fmtSize(data.limit) : "";
    return data && /full/.test(data.error || "")
      ? `This room has no space left for ${att.name}${limit ? ` (${limit} in total).` : "."}`
      : `${att.name} is larger than the ${limit || "upload"} limit.`;
  }
  if (status === 401 || status === 404) return "This link is wrong or the room is gone.";
  return `Could not upload ${att.name}: ${data?.error || `HTTP ${status}`}.`;
}

// Clipboard screenshots arrive as image.png; give them a name that says where they came from.
function nameFor(file: File, pasted: boolean) {
  if (!pasted || !file.type.startsWith("image/") || (file.name && !/^image\.\w+$/i.test(file.name))) return file.name || "file";
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
  return `pasted-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

/** Each file uploads as soon as it is attached; sending waits for all of them. */
export function useAttachments(callbacks: Callbacks) {
  const list = useRef<Att[]>([]);
  const seq = useRef(0);
  const cb = useRef(callbacks);
  useLayoutEffect(() => {
    cb.current = callbacks;
  });
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const drop = useCallback((att: Att) => {
    list.current = list.current.filter((a) => a !== att);
    if (att.preview) URL.revokeObjectURL(att.preview);
    rerender();
  }, []);

  const remove = useCallback(
    (att: Att) => {
      att.removed = true;
      if (att.xhr && att.state === "uploading") att.xhr.abort();
      drop(att);
    },
    [drop],
  );

  const clear = useCallback(() => list.current.slice().forEach(remove), [remove]);

  const upload = useCallback(
    (att: Att) =>
      new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        att.xhr = xhr;
        const fail = (msg: string) => {
          att.state = "error";
          if (!att.removed) {
            drop(att);
            cb.current.onError(msg);
          }
          resolve();
        };
        xhr.upload.addEventListener("progress", (e) => {
          if (!e.lengthComputable) return;
          att.pct = Math.round((e.loaded / e.total) * 100);
          rerender();
        });
        xhr.addEventListener("load", () => {
          let data: { id?: string; size?: number; error?: string; limit?: number } | null = null;
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            // no body
          }
          if (xhr.status === 201 && data?.id) {
            att.state = "done";
            att.id = data.id;
            att.size = data.size;
            att.pct = 100;
            rerender();
            if (!att.removed) cb.current.announce(`${att.name} uploaded`);
            return resolve();
          }
          if (xhr.status === 410) {
            att.state = "error";
            cb.current.onEnded();
            return resolve();
          }
          fail(uploadError(att, xhr.status, data));
        });
        xhr.addEventListener("error", () => fail(`Could not reach the server to upload ${att.name}.`));
        xhr.addEventListener("abort", () => {
          att.state = "error";
          resolve();
        });
        xhr.open("POST", `${base}/api/files?name=${encodeURIComponent(att.name)}`);
        xhr.setRequestHeader("content-type", att.file.type || "application/octet-stream");
        xhr.send(att.file);
      }),
    [drop],
  );

  const add = useCallback(
    (input: FileList | File[], pasted: boolean) => {
      const files = [...input];
      if (!files.length) return;
      const room = MAX_ATTACH - list.current.length;
      if (files.length > room) {
        cb.current.onError(`Attach up to ${MAX_ATTACH} files per message.`);
        files.splice(Math.max(0, room));
        if (!files.length) return;
      }
      const added = files.map((file) => {
        const att: Att = { key: ++seq.current, file, name: nameFor(file, pasted), state: "uploading", pct: null };
        if (INLINE_TYPES.has(file.type)) att.preview = URL.createObjectURL(file);
        att.promise = upload(att);
        return att;
      });
      list.current = [...list.current, ...added];
      rerender();
      cb.current.announce(added.length === 1 ? `Attached ${added[0].name}` : `Attached ${added.length} files`);
    },
    [upload],
  );

  return { atts: list.current, current: list, add, remove, drop, clear };
}
