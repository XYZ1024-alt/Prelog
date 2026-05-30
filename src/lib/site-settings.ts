import { cache } from "react";

import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const getSiteSettings = cache(async () => {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
  });

  if (!settings) {
    return {
      ...DEFAULT_SITE_SETTINGS,
      id: SITE_SETTINGS_ID,
    };
  }

  return settings;
});

export function splitAboutTopics(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
