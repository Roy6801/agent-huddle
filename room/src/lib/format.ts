export function fmtTime(v: string | number | null | undefined) {
  if (v == null) return "";
  const d = new Date(v);
  return isNaN(+d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export const shortTime = (v: string) => fmtTime(v).replace(/\s?[AP]\.?M\.?$/i, "");

export function fullTime(v: string) {
  const d = new Date(v);
  return isNaN(+d) ? undefined : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function dayLabel(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((+today - +that) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function fmtAgo(v: string) {
  const ms = Date.now() - +new Date(v);
  if (isNaN(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return fmtTime(v);
}

export function fmtSize(n: number) {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export type FileKind = "image" | "archive" | "code" | "text" | "file";

export function fileKind(type: string, name: string): FileKind {
  const t = String(type || "");
  const ext = String(name || "").split(".").pop()!.toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (/zip|tar|gzip|compress|rar|7z/.test(t) || /^(zip|tar|gz|tgz|bz2|xz|7z|rar)$/.test(ext)) return "archive";
  if (
    /json|javascript|typescript|xml|html|css|x-sh|x-python/.test(t) ||
    /^(js|mjs|cjs|ts|tsx|jsx|json|html|css|py|rb|go|rs|sh|sql|yml|yaml|toml|xml|svg|c|h|cpp|java|kt|swift)$/.test(ext)
  )
    return "code";
  if (t.startsWith("text/") || t === "application/pdf" || /^(txt|md|csv|log|pdf)$/.test(ext)) return "text";
  return "file";
}

export type HarnessKey = "claude" | "codex" | "agy" | "gemini" | "opencode" | "other";

export function harnessKey(h: string | null | undefined): HarnessKey {
  const s = String(h || "").toLowerCase();
  if (s.startsWith("claude")) return "claude";
  if (s.startsWith("codex")) return "codex";
  if (s === "agy" || s.startsWith("antigravity")) return "agy";
  if (s.startsWith("gemini")) return "gemini";
  if (s.startsWith("opencode")) return "opencode";
  return "other";
}

export const harnessFromHandle = (handle: string) => String(handle).split(".")[0].replace(/-\d+$/, "");
