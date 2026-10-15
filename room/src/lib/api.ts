// The page is served at /s/<id>/h/<token>/; every API call hangs off that path.
export const base = location.pathname.replace(/\/$/, "");

export const fileUrl = (id: string) => `${base}/api/files/${encodeURIComponent(id)}`;

export type ApiError = { error?: string; message?: string; instruction?: string; valid?: string[] };

export type Posted<T> = { r: Response; data: (T & ApiError) | null };

export async function postJson<T = ApiError>(path: string, body: unknown): Promise<Posted<T>> {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: (T & ApiError) | null = null;
  try {
    data = await r.json();
  } catch {
    // no body
  }
  return { r, data };
}

export type UploadReply = { id?: string; size?: number } & ApiError;

export type UploadOutcome = { kind: "load"; status: number; data: UploadReply | null } | { kind: "error" } | { kind: "abort" };

export type Upload = { done: Promise<UploadOutcome>; abort: () => void };

/** XHR rather than fetch, for upload progress. */
export function uploadFile(file: File, name: string, onProgress: (pct: number) => void): Upload {
  const xhr = new XMLHttpRequest();
  const done = new Promise<UploadOutcome>((resolve) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      let data: UploadReply | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // no body
      }
      resolve({ kind: "load", status: xhr.status, data });
    });
    xhr.addEventListener("error", () => resolve({ kind: "error" }));
    xhr.addEventListener("abort", () => resolve({ kind: "abort" }));
    xhr.open("POST", `${base}/api/files?name=${encodeURIComponent(name)}`);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.send(file);
  });
  return { done, abort: () => xhr.abort() };
}

export function errMain(r: Response, data: ApiError | null) {
  if (r.status === 401 || data?.error === "unknown_room" || data?.error === "not_found") return "This link is wrong or the room is gone.";
  return data?.message || `Request failed (HTTP ${r.status})`;
}

const CHIPS: Record<string, { label: string; prefix: string }> = {
  unknown_mention: { label: "Valid mentions", prefix: "" },
  unknown_assignee: { label: "Valid assignees", prefix: "@" },
  unknown_file: { label: "Valid files", prefix: "" },
};

/** The valid values an error lists, labelled and shown the way you would type them. */
export function chipsOf(data: ApiError | null) {
  const chips = data?.error ? CHIPS[data.error] : undefined;
  if (!chips || !Array.isArray(data?.valid)) return {};
  return { valid: data.valid.map((v) => chips.prefix + v), validLabel: chips.label };
}

export async function copyText(str: string) {
  try {
    await navigator.clipboard.writeText(str);
    return true;
  } catch {
    // fall back below
  }
  const ta = document.createElement("textarea");
  ta.value = str;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
