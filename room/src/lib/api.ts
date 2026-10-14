// The page is served at /s/<id>/h/<token>/; every API call hangs off that path.
export const base = location.pathname.replace(/\/$/, "");

export const fileUrl = (id: string) => `${base}/api/files/${encodeURIComponent(id)}`;

export type ApiError = { error?: string; valid?: string[]; limit?: number };

export async function postJson<T = ApiError>(path: string, body: unknown) {
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

export function errMain(r: Response, data: ApiError | null) {
  if (r.status === 401 || r.status === 404) return "This link is wrong or the room is gone.";
  return data?.error || `Request failed (HTTP ${r.status})`;
}

export const validOf = (data: ApiError | null) => (data && Array.isArray(data.valid) ? data.valid : null);

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
