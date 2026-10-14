import { ImageResponse } from "next/og";

import { BrandMark } from "@/lib/brand-icon";
import { BRAND, DESCRIPTION, SITE_NAME, TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: BRAND.ink,
          color: BRAND.paper,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <BrandMark size={72} radius={16} />
          <div style={{ fontSize: 40, fontWeight: 600 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{TAGLINE}</div>
          <div style={{ fontSize: 32, lineHeight: 1.4, opacity: 0.7, maxWidth: 960 }}>{`${DESCRIPTION.split(". ")[0]}.`}</div>
        </div>
      </div>
    ),
    size,
  );
}
