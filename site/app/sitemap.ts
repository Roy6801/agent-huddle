import type { MetadataRoute } from "next";

import { LAST_MODIFIED, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(LAST_MODIFIED), changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/changelog`, lastModified: new Date(LAST_MODIFIED), changeFrequency: "weekly", priority: 0.5 },
  ];
}
