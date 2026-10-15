import { useCallback, useLayoutEffect, useReducer, useRef } from "react";

import type { Upload, UploadReply } from "@/lib/api";
import { INLINE_TYPES } from "@/lib/format";

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
  abort?: () => void;
  promise?: Promise<void>;
  removed?: boolean;
};

type Callbacks = {
  onError: (message: string) => void;
  onEnded: () => void;
  announce: (message: string) => void;
  upload: (file: File, name: string, onProgress: (pct: number) => void) => Upload;
};

function uploadError(att: Att, status: number, data: UploadReply | null) {
  if (status === 401 || status === 404) return "This link is wrong or the room is gone.";
  return `Could not upload ${att.name}: ${data?.message || `HTTP ${status}`}`;
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
      if (att.abort && att.state === "uploading") att.abort();
      drop(att);
    },
    [drop],
  );

  const clear = useCallback(() => list.current.slice().forEach(remove), [remove]);

  const upload = useCallback(
    (att: Att) => {
      const job = cb.current.upload(att.file, att.name, (pct) => {
        att.pct = pct;
        rerender();
      });
      att.abort = job.abort;
      return job.done.then((res) => {
        if (res.kind === "abort") {
          att.state = "error";
          return;
        }
        const fail = (msg: string) => {
          att.state = "error";
          if (!att.removed) {
            drop(att);
            cb.current.onError(msg);
          }
        };
        if (res.kind === "error") return fail(`Could not reach the server to upload ${att.name}.`);
        const { status, data } = res;
        if (status === 201 && data?.id) {
          att.state = "done";
          att.id = data.id;
          att.size = data.size;
          att.pct = 100;
          rerender();
          if (!att.removed) cb.current.announce(`${att.name} uploaded`);
          return;
        }
        if (status === 410) {
          att.state = "error";
          cb.current.onEnded();
          return;
        }
        fail(uploadError(att, status, data));
      });
    },
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
