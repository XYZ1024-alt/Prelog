import { cache } from "react";

import { FRIEND_LINKS_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { createPublicCachedQuery } from "@/lib/public-cache";

async function queryPublicFriendLinks() {
  return prisma.friendLink.findMany({
    where: { isVisible: true },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
      { id: "asc" },
    ],
  });
}

const getCachedPublicFriendLinks = createPublicCachedQuery(
  queryPublicFriendLinks,
  ["prelog:query:friend-links:v1"],
  [FRIEND_LINKS_CACHE_TAG],
);

export const getPublicFriendLinks = cache(getCachedPublicFriendLinks);

export function getAdminFriendLinks() {
  return prisma.friendLink.findMany({
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
      { id: "asc" },
    ],
  });
}
