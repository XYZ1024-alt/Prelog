import bcrypt from "bcryptjs";

import { Prisma, type PrismaClient } from "../../src/generated/prisma/client.ts";
import { ADMIN_USER_ID, SITE_SETTINGS_ID } from "../../src/lib/constants.ts";
import { createArticleGlyphRecipe, createArticleGlyphSignals } from "../../src/lib/glyph-recipe.ts";

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

export const TEST_FRIEND_LINKS = {
  hidden: {
    name: "Hidden Friend",
    url: "https://hidden.example.com/",
  },
  visible: {
    name: "Visible Friend",
    url: "https://visible.example.com/",
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
  await prisma.friendLink.createMany({
    data: [
      {
        description: "A visible friend link used by public page tests.",
        isVisible: true,
        name: TEST_FRIEND_LINKS.visible.name,
        sortOrder: 10,
        url: TEST_FRIEND_LINKS.visible.url,
      },
      {
        description: "A hidden friend link used by visibility tests.",
        isVisible: false,
        name: TEST_FRIEND_LINKS.hidden.name,
        sortOrder: 0,
        url: TEST_FRIEND_LINKS.hidden.url,
      },
    ],
  });
  await createPublishedPost(prisma, {
    categoryId: engineering.id,
    categoryName: engineering.name,
    categorySlug: engineering.slug,
    content: `## Launch

Prelog ships a **public article** powered by reliable rendering, with [semantic links](https://example.com/docs) and \`inline code\`.

> The visible article must preserve rich Markdown at every viewport.

1. Keep one semantic tree.
2. Keep every inline element.

| Layer | Status |
| --- | --- |
| Markdown | Visible |

\`\`\`ts
const semantic = true;
\`\`\`

\`\`\`
plain code

with spacing
\`\`\`

## Delivery

The second section makes article navigation progress observable.`,
    publishedAt: FIRST_PUBLISHED_AT,
    slug: TEST_POSTS.published.slug,
    tags: [nextTag, prismaTag],
    title: TEST_POSTS.published.title,
  });
  await createPublishedPost(prisma, {
    categoryId: product.id,
    categoryName: product.name,
    categorySlug: product.slug,
    content: "## Search\n\nSearch quality uses category, tag, title, and body signals.",
    publishedAt: SECOND_PUBLISHED_AT,
    slug: TEST_POSTS.search.slug,
    tags: [prismaTag],
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
    friendsContactLabel: "Contact Test Prelog",
    friendsContactUrl: "/about",
    friendsEnabled: true,
    friendsIntro: "A deterministic friend directory for release checks.",
    friendsRequirements: "Runs over HTTPS\nPublishes original writing",
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
    readonly categoryName: string;
    readonly categorySlug: string;
    readonly content: string;
    readonly publishedAt: Date;
    readonly slug: string;
    readonly tags: readonly { readonly id: string; readonly name: string; readonly slug: string }[];
    readonly title: string;
  },
) {
  const post = await prisma.post.create({
    data: {
      categoryId: options.categoryId,
      content: options.content,
      excerpt: `Excerpt for ${options.title}`,
      publishedAt: options.publishedAt,
      readingMinutes: 1,
      slug: options.slug,
      status: "PUBLISHED",
      tags: { create: options.tags.map(({ id }) => ({ tag: { connect: { id } } })) },
      title: options.title,
    },
  });
  const recipe = createArticleGlyphRecipe({
    category: options.categorySlug,
    labels: {
      category: options.categoryName,
      tags: options.tags.map((tag) => tag.name),
    },
    postId: post.id,
    signals: createArticleGlyphSignals(options.content),
    tags: options.tags.map((tag) => tag.slug).sort(),
    title: options.title,
  });

  await prisma.post.update({
    where: { id: post.id },
    data: {
      glyphGeneratedAt: new Date(),
      glyphRecipe: recipe as unknown as Prisma.InputJsonValue,
      glyphSourceHash: recipe.sourceHash,
      updatedAt: post.updatedAt,
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
