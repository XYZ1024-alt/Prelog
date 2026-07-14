import { describe, expect, test } from "vitest";

import { getAdminFriendLinks, getPublicFriendLinks } from "@/lib/friend-links";
import { prisma } from "@/lib/prisma";
import { TEST_FRIEND_LINKS } from "../helpers/seed-test-data.ts";

describe("friend link integration", () => {
  test("returns only visible links in stable sort order", async () => {
    const suffix = Date.now().toString(36);
    const created = await prisma.friendLink.createManyAndReturn({
      data: [
        {
          description: "Second alphabetical entry.",
          name: `Beta ${suffix}`,
          sortOrder: 5,
          url: `https://beta-${suffix}.example.com/`,
        },
        {
          description: "First alphabetical entry.",
          name: `Alpha ${suffix}`,
          sortOrder: 5,
          url: `https://alpha-${suffix}.example.com/`,
        },
      ],
      select: { id: true },
    });

    try {
      const publicLinks = await getPublicFriendLinks();
      const relevantNames = publicLinks
        .filter((friendLink) => friendLink.name.includes(suffix))
        .map((friendLink) => friendLink.name);

      expect(relevantNames).toEqual([`Alpha ${suffix}`, `Beta ${suffix}`]);
      expect(publicLinks.map((friendLink) => friendLink.name))
        .toContain(TEST_FRIEND_LINKS.visible.name);
      expect(publicLinks.map((friendLink) => friendLink.name))
        .not.toContain(TEST_FRIEND_LINKS.hidden.name);
    } finally {
      await prisma.friendLink.deleteMany({ where: { id: { in: created.map(({ id }) => id) } } });
    }
  });

  test("keeps hidden records available to the admin query", async () => {
    const adminLinks = await getAdminFriendLinks();

    expect(adminLinks.map((friendLink) => friendLink.name))
      .toEqual(expect.arrayContaining([
        TEST_FRIEND_LINKS.visible.name,
        TEST_FRIEND_LINKS.hidden.name,
      ]));
  });
});
