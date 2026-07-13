import type { MetadataRoute } from "next";

import { PUBLIC_ADMIN_PATH } from "@/lib/admin-path";
import { createSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const disallow = Array.from(new Set(["/admin", PUBLIC_ADMIN_PATH, "/api", "/preview"]));

  return {
    host: createSiteUrl("/").origin,
    rules: {
      allow: ["/", "/api/og/"],
      disallow,
      userAgent: "*",
    },
    sitemap: createSiteUrl("/sitemap.xml").toString(),
  };
}
