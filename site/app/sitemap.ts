import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

const BUILD_DATE = new Date();

function changelogDate(): Date {
  const md = fs.readFileSync(path.join(process.cwd(), "public", "CHANGELOG.md"), "utf8");
  const match = md.match(/^## \d+\.\d+\.\d+ \((\d{4}-\d{2}-\d{2})\)/m);
  return match ? new Date(match[1]) : BUILD_DATE;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: BUILD_DATE, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/changelog`, lastModified: changelogDate(), changeFrequency: "weekly", priority: 0.5 },
  ];
}
