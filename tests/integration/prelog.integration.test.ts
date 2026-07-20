import { describe, expect, test } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  getCategoriesWithCounts,
  getPublishedPostBySlug,
  getPublishedPosts,
  getTagsWithCounts,
  searchPublishedPosts,
} from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "@/lib/constants";
import { resolvePostCover } from "@/lib/post-cover";
import { TEST_POSTS } from "../helpers/seed-test-data.ts";

describe("site settings integration", () => {
  test("returns default site settings when no database row exists", async () => {
    await prisma.siteSettings.deleteMany();

    const settings = await getSiteSettings();

    expect(settings).toMatchObject({
      id: SITE_SETTINGS_ID,
      siteName: DEFAULT_SITE_SETTINGS.siteName,
    });
  });
});

describe("published post integration", () => {
  test("returns only published posts in newest-first order", async () => {
    const posts = await getPublishedPosts();

    expect(posts.map((post) => post.slug)).toEqual([TEST_POSTS.search.slug, TEST_POSTS.published.slug]);
    expect(posts.some((post) => post.slug === TEST_POSTS.draft.slug)).toBe(false);
    expect(posts.map((post) => resolvePostCover(post).mode)).toEqual(["GLYPH", "GLYPH"]);
  });

  test("loads a published post with approved comments only", async () => {
    const post = await getPublishedPostBySlug(TEST_POSTS.published.slug);

    expect(post?.title).toBe(TEST_POSTS.published.title);
    expect(post?.comments).toEqual([]);
  });

  test("counts only published posts in taxonomies", async () => {
    const [categories, tags] = await Promise.all([getCategoriesWithCounts(), getTagsWithCounts()]);
    const engineering = categories.find((category) => category.slug === "engineering");
    const nextTag = tags.find((tag) => tag.slug === "next-js");

    expect(engineering?._count.posts).toBe(1);
    expect(nextTag?._count.posts).toBe(1);
  });

  test("searches across title, body, category, and tags", async () => {
    const [titleResults, bodyResults, categoryResults, tagResults] = await Promise.all([
      searchPublishedPosts("Search"),
      searchPublishedPosts("powered"),
      searchPublishedPosts("Engineering"),
      searchPublishedPosts("Next.js"),
    ]);

    expect(titleResults[0]?.slug).toBe(TEST_POSTS.search.slug);
    expect(bodyResults.map((post) => post.slug)).toContain(TEST_POSTS.published.slug);
    expect(categoryResults.map((post) => post.slug)).toContain(TEST_POSTS.published.slug);
    expect(tagResults.map((post) => post.slug)).toContain(TEST_POSTS.published.slug);
  });
});
