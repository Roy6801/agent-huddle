import { ImageResponse } from "next/og";

import { BRAND } from "@/lib/site";

const DOTS = [
  { x: 11, y: 11, fill: BRAND.paper },
  { x: 21, y: 11, fill: BRAND.paper },
  { x: 11, y: 21, fill: BRAND.paper },
  { x: 21, y: 21, fill: BRAND.you },
];

export function BrandMark({ size, radius = 0 }: { size: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx={radius} fill={BRAND.ink} />
      {DOTS.map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="3.2" fill={d.fill} />
      ))}
    </svg>
  );
}

export function renderIcon(size: number, radius = 0) {
  return new ImageResponse(<BrandMark size={size} radius={radius} />, { width: size, height: size });
}
