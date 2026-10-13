import { cn } from "@/lib/utils";

// Pixel art, not UI: these colors are the sprite itself and stay fixed across themes.
const ART: Record<string, string> = { o: "#1e293b", b: "#38bdf8", k: "#0f172a", y: "#fbbf24" };

const PIXELS = [
  "..oooo..",
  ".obbbbo.",
  ".okbbko.",
  ".obbbbo.",
  "..oyyo..",
  ".obbbbo.",
  ".ob..bo.",
  ".oo..oo.",
];

export function PixelSprite({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 8 8" shapeRendering="crispEdges" className={cn("block", className)}>
      {PIXELS.flatMap((row, y) =>
        [...row].map((c, x) => (ART[c] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={ART[c]} /> : null)),
      )}
    </svg>
  );
}
