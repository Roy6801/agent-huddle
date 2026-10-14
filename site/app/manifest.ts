import type { MetadataRoute } from "next";

import { BRAND, DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "browser",
    background_color: BRAND.paper,
    theme_color: BRAND.ink,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
