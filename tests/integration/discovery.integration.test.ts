import { describe, expect, test } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as getRss } from "@/app/rss.xml/route";
import { prisma } from "@/lib/prisma";
import {
  getPublishedPostArchivePage,
  getPublishedPostBySlug,
  getPublishedPostNavigation,
  getRelatedPublishedPosts,
  getCategoriesWithCounts,
  getCategoryWithPublishedPosts,
  getTagWithPublishedPosts,
  getTagsWithCounts,
  searchPublishedPostsPage,
} from "@/lib/posts";
import { TEST_POSTS } from "../helpers/seed-test-data.ts";

describe("public content discovery", () => {
  test("paginates the archive with a stable published-post cursor", async () => {
    const firstPage = await getPublishedPostArchivePage({ pageSize: 1 });
    expect(firstPage?.posts.map((post) => post.slug)).toEqual([TEST_POSTS.search.slug]);
    expect(firstPage?.hasNextPage).toBe(true);

    const secondPage = await getPublishedPostArchivePage({
      cursor: firstPage?.nextCursor ?? undefined,
      pageSize: 1,
    });
    expect(secondPage?.posts.map((post) => post.slug)).toEqual([TEST_POSTS.published.slug]);
    expect(await getPublishedPostArchivePage({ cursor: "not-a-post" })).toBeNull();
  });

  test("loads bounded adjacent and related posts", async () => {
    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: TEST_POSTS.published.slug },
      include: { tags: { include: { tag: true } } },
    });
    const navigation = await getPublishedPostNavigation(post.id);
    const related = await getRelatedPublishedPosts({
      categoryId: post.categoryId,
      postId: post.id,
      tagIds: post.tags.map(({ tag }) => tag.id),
    });

    expect(navigation.next?.slug).toBe(TEST_POSTS.search.slug);
    expect(navigation.previous).toBeNull();
    expect(related.map(({ post: item }) => item.slug)).toContain(TEST_POSTS.search.slug);
    expect(related[0]?.relevance.sharedTags.map((tag) => tag.slug)).toContain("prisma");
  });

  test("ranks then paginates expanded search candidates", async () => {
    const firstPage = await searchPublishedPostsPage("Prisma", { page: 1, pageSize: 1 });
    const secondPage = await searchPublishedPostsPage("Prisma", { page: 2, pageSize: 1 });

    expect(firstPage.total).toBe(2);
    expect(firstPage.pageCount).toBe(2);
    expect(firstPage.posts[0]?.id).not.toBe(secondPage.posts[0]?.id);
  });

  test("counts only approved comments in public post metadata", async () => {
    const post = await prisma.post.findUniqueOrThrow({
      select: { id: true },
      where: { slug: TEST_POSTS.published.slug },
    });
    const comments = await prisma.comment.createManyAndReturn({
      data: [
        createComment(post.id, "approved", "APPROVED"),
        createComment(post.id, "pending", "PENDING"),
      ],
      select: { id: true },
    });

    try {
      const publicPost = await getPublishedPostBySlug(TEST_POSTS.published.slug);
      expect(publicPost?._count.comments).toBe(1);
      expect(publicPost?.comments).toHaveLength(1);
      expect(publicPost?.comments[0]).not.toHaveProperty("email");
      expect(publicPost?.comments[0]).not.toHaveProperty("ipHash");
    } finally {
      await prisma.comment.deleteMany({
        where: { id: { in: comments.map(({ id }) => id) } },
      });
    }
  });

  test("does not expose taxonomy that is referenced only by drafts", async () => {
    const suffix = Date.now().toString(36);
    const category = await prisma.category.create({
      data: { name: "Draft category", slug: `draft-category-${suffix}` },
    });
    const tag = await prisma.tag.create({
      data: { name: "Draft tag", slug: `draft-tag-${suffix}` },
    });
    const post = await prisma.post.create({
      data: {
        categoryId: category.id,
        content: "## Draft only\n\nPrivate taxonomy.",
        excerpt: "Private taxonomy.",
        slug: `draft-taxonomy-${suffix}`,
        status: "DRAFT",
        tags: { create: [{ tagId: tag.id }] },
        title: "Draft taxonomy",
      },
    });

    try {
      const [categories, tags, categoryPage, tagPage] = await Promise.all([
        getCategoriesWithCounts(),
        getTagsWithCounts(),
        getCategoryWithPublishedPosts(category.slug),
        getTagWithPublishedPosts(tag.slug),
      ]);
      expect(categories.map((item) => item.slug)).not.toContain(category.slug);
      expect(tags.map((item) => item.slug)).not.toContain(tag.slug);
      expect(categoryPage).toBeNull();
      expect(tagPage).toBeNull();
    } finally {
      await prisma.post.delete({ where: { id: post.id } });
      await prisma.tag.delete({ where: { id: tag.id } });
      await prisma.category.delete({ where: { id: category.id } });
    }
  });

  test("publishes only public URLs through sitemap, robots, and RSS", async () => {
    const [entries, response] = await Promise.all([sitemap(), getRss()]);
    const urls = entries.map((entry) => entry.url);
    const rss = await response.text();
    const robotRules = robots().rules;
    const allow = Array.isArray(robotRules) ? robotRules.flatMap((rule) => rule.allow ?? []) : robotRules.allow ?? [];
    const disallow = Array.isArray(robotRules) ? robotRules.flatMap((rule) => rule.disallow ?? []) : robotRules.disallow ?? [];

    expect(urls.some((url) => url.endsWith(`/posts/${TEST_POSTS.published.slug}`))).toBe(true);
    expect(urls.some((url) => url.endsWith(`/posts/${TEST_POSTS.draft.slug}`))).toBe(false);
    expect(urls.some((url) => url.endsWith("/categories/engineering"))).toBe(true);
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(rss).toContain(TEST_POSTS.published.title);
    expect(rss).not.toContain(TEST_POSTS.draft.title);
    expect(disallow).toContain("/admin");
    expect(disallow).toContain("/api");
    expect(disallow).toContain("/preview");
    expect(allow).toContain("/api/og/");
    expect(disallow).not.toContain("/search");
  });
});

function createComment(postId: string, suffix: string, status: "APPROVED" | "PENDING") {
  return {
    author: `Reader ${suffix}`,
    body: `Comment ${suffix}`,
    email: `${suffix}@example.com`,
    postId,
    status,
  } as const;
}
