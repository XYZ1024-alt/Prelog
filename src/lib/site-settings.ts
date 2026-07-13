import { cache } from "react";

import { SITE_SETTINGS_CACHE_TAG } from "@/lib/cache-tags";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createPublicCachedQuery } from "@/lib/public-cache";

async function querySiteSettings() {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
  });

  if (!settings) {
    const now = new Date();

    return {
      ...DEFAULT_SITE_SETTINGS,
      createdAt: now,
      id: SITE_SETTINGS_ID,
      updatedAt: now,
    };
  }

  return settings;
}

const getCachedSiteSettings = createPublicCachedQuery(
  querySiteSettings,
  ["prelog:query:site-settings:v1"],
  [SITE_SETTINGS_CACHE_TAG],
);

export const getSiteSettings = cache(getCachedSiteSettings);

export function splitAboutTopics(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
