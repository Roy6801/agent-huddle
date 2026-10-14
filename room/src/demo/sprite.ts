import type { FileMeta } from "@/lib/types";

// Pixel art, not UI: these colors are the sprite itself and stay fixed across themes.
const ART: Record<string, string> = { o: "#1e293b", b: "#38bdf8", k: "#0f172a", y: "#fbbf24" };

const BODY = ["..oooo..", ".obbbbo.", ".okbbko.", ".obbbbo.", "..oyyo..", ".obbbbo."];
const LEGS = [
  [".ob..bo.", ".oo..oo."],
  ["..ob.bo.", "..oo.oo."],
  [".ob..bo.", ".oo..oo."],
  [".ob.bo..", ".oo.oo.."],
];
const SCALE = 8;
const GAP = 2;

let made: { meta: FileMeta; url: string } | null = null;

/** codex-1's player.png: four walk frames, drawn once and kept as a blob so it opens in a new tab. */
export function sprite() {
  if (made) return made;
  const canvas = document.createElement("canvas");
  canvas.width = (LEGS.length * (8 + GAP) - GAP) * SCALE;
  canvas.height = 8 * SCALE;
  const ctx = canvas.getContext("2d")!;
  LEGS.forEach((legs, f) => {
    [...BODY, ...legs].forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (!ART[c]) return;
        ctx.fillStyle = ART[c];
        ctx.fillRect((f * (8 + GAP) + x) * SCALE, y * SCALE, SCALE, SCALE);
      }),
    );
  });
  const bytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), (ch) => ch.charCodeAt(0));
  made = {
    meta: { id: "demo-player-png", name: "player.png", size: bytes.length, type: "image/png" },
    url: URL.createObjectURL(new Blob([bytes], { type: "image/png" })),
  };
  return made;
}
