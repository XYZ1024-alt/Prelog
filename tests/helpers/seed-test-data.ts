import bcrypt from "bcryptjs";

import type { PrismaClient } from "../../src/generated/prisma/client.ts";
import { ADMIN_USER_ID, SITE_SETTINGS_ID } from "../../src/lib/constants.ts";

export const TEST_ADMIN = {
  email: "admin@example.com",
  name: "Test Admin",
  password: "TestPassword123!",
} as const;

export const TEST_POSTS = {
  draft: {
    slug: "draft-only",
    title: "Draft Only",
  },
  published: {
    slug: "visible-launch-notes",
    title: "Visible Launch Notes",
  },
  search: {
    slug: "search-deep-dive",
    title: "Search Deep Dive",
  },
} as const;

const HASH_ROUNDS = 12;
const FIRST_PUBLISHED_AT = new Date("2026-01-10T08:00:00.000Z");
const SECOND_PUBLISHED_AT = new Date("2026-01-11T08:00:00.000Z");

export async function seedTestData(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, HASH_ROUNDS);
  const engineering = await prisma.category.create({
    data: { name: "Engineering", slug: "engineering" },
  });
  const product = await prisma.category.create({
    data: { name: "Product", slug: "product" },
  });
  const nextTag = await prisma.tag.create({ data: { name: "Next.js", slug: "next-js" } });
  const prismaTag = await prisma.tag.create({ data: { name: "Prisma", slug: "prisma" } });

  await prisma.user.create({
    data: { email: TEST_ADMIN.email, id: ADMIN_USER_ID, name: TEST_ADMIN.name, passwordHash, role: "ADMIN" },
  });
  await prisma.siteSettings.create({
    data: createSiteSettings(),
  });
  await createPublishedPost(prisma, {
    categoryId: engineering.id,
    content: "## Launch\n\nPrelog ships a public article powered by Next.js and Prisma.",
    publishedAt: FIRST_PUBLISHED_AT,
    slug: TEST_POSTS.published.slug,
    tagIds: [nextTag.id, prismaTag.id],
    title: TEST_POSTS.published.title,
  });
  await createPublishedPost(prisma, {
    categoryId: product.id,
    content: "## Search\n\nSearch quality uses category, tag, title, and body signals.",
    publishedAt: SECOND_PUBLISHED_AT,
    slug: TEST_POSTS.search.slug,
    tagIds: [prismaTag.id],
    title: TEST_POSTS.search.title,
  });
  await prisma.post.create({
    data: createDraftPost(engineering.id, nextTag.id),
  });
}

function createSiteSettings() {
  return {
    aboutAudience: "Readers building production software.",
    aboutIntro: "A test blog for reliable release checks.",
    aboutTitle: "About Test Prelog",
    aboutTopics: "Next.js, Prisma, Testing",
    aboutWriting: "Engineering notes and product decisions.",
    footerPrimary: "Test Prelog footer",
    footerSecondary: "Built for automated verification",
    heroExcerpt: "Release-focused notes for the test suite.",
    heroTitle: "Test Prelog",
    id: SITE_SETTINGS_ID,
    siteName: "Test Prelog",
    siteTagline: "A deterministic test blog",
  };
}

async function createPublishedPost(
  prisma: PrismaClient,
  options: {
    readonly categoryId: string;
    readonly content: string;
    readonly publishedAt: Date;
    readonly slug: string;
    readonly tagIds: readonly string[];
    readonly title: string;
  },
) {
  await prisma.post.create({
    data: {
      categoryId: options.categoryId,
      content: options.content,
      excerpt: `Excerpt for ${options.title}`,
      publishedAt: options.publishedAt,
      readingMinutes: 1,
      slug: options.slug,
      status: "PUBLISHED",
      tags: { create: options.tagIds.map((id) => ({ tag: { connect: { id } } })) },
      title: options.title,
    },
  });
}

function createDraftPost(categoryId: string, tagId: string) {
  return {
    categoryId,
    content: "## Draft\n\nThis post should not be visible publicly.",
    excerpt: "Draft excerpt",
    readingMinutes: 1,
    slug: TEST_POSTS.draft.slug,
    status: "DRAFT" as const,
    tags: { create: [{ tag: { connect: { id: tagId } } }] },
    title: TEST_POSTS.draft.title,
  };
}
