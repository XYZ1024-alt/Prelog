import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.ts";
import {
  createArticleGlyphRecipe,
  createArticleGlyphSignals,
  currentGlyphRecipeSchema,
} from "../src/lib/glyph-recipe.ts";
import { ADMIN_USER_ID, DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "../src/lib/constants.ts";
import { createExcerpt, estimateReadingMinutes, toSlug } from "../src/lib/text.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getRequiredEnv("DATABASE_URL") }),
});
const HASH_ROUNDS = 12;
const SAMPLE_DATE = new Date("2026-05-29T09:00:00.000Z");

const samplePosts = [
  {
    title: "把 Pretext 放进博客阅读体验",
    category: "工程笔记",
    tags: ["Next.js", "Pretext", "文字排版"],
    content: `# 把 Pretext 放进博客阅读体验

Pretext 不是 Markdown 渲染器，而是一个文本测量和布局引擎。它适合处理普通 DOM 很难稳定完成的任务：提前知道段落高度、把文本绕过浮动区域、按行驱动动画，以及在富文本 inline 中保持准确的断行。

## 为什么博客需要它

- 首页卡片可以在数据加载后保持稳定高度。
- 文章标题可以根据真实分行做更自然的入场动画。
- 引用、标签、代码片段这些 inline 元素可以参与同一套测量。

> 文字不只是内容，它也可以成为界面的主控件。

这一版仍然保留语义化 HTML 正文，Pretext 负责增强体验，而不是牺牲 SEO 和可访问性。`,
  },
  {
    title: "用 Prisma 管住博客后台的边界",
    category: "后台系统",
    tags: ["Prisma", "PostgreSQL", "Admin"],
    content: `# 用 Prisma 管住博客后台的边界

后台第一版覆盖文章管理和评论管理。文章有草稿、发布、分类、标签、SEO 字段和 Markdown 正文；评论默认立即显示，但管理员可以隐藏、恢复或删除。

## 数据边界

所有写入都经过 Zod 校验，再交给 Prisma。数据库使用 PostgreSQL，关系通过 Prisma schema 表达，避免在业务代码中拼接 SQL。

\`\`\`ts
await prisma.post.create({ data })
\`\`\`

失败应该直接暴露，方便定位真实问题。`,
  },
  {
    title: "黑白主题不是少设计",
    category: "界面设计",
    tags: ["Theme", "Motion", "Design"],
    content: `# 黑白主题不是少设计

黑白主题的关键不在于颜色少，而在于层级、留白、对比和动效都要承担表达。Prelog 的两个主色是 \`#E2E7BF\` 和 \`#2B31F\`，一个负责柔和高亮，一个负责强动作。

## 交互原则

按钮、标签、焦点态和阅读进度都使用同一套颜色语义。动画使用 Framer Motion 和 CSS transition，但正文阅读区保持稳定，避免让动效抢走注意力。`,
  },
] as const;

async function main() {
  const email = getRequiredEnv("ADMIN_EMAIL");
  const password = getRequiredEnv("ADMIN_PASSWORD");
  const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);

  await prisma.user.deleteMany({
    where: {
      id: { not: ADMIN_USER_ID },
    },
  });
  await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: { email, passwordHash, role: "ADMIN" },
    create: { id: ADMIN_USER_ID, email, passwordHash, name: "Prelog Admin", role: "ADMIN" },
  });
  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {},
    create: {
      id: SITE_SETTINGS_ID,
      ...DEFAULT_SITE_SETTINGS,
    },
  });

  for (const sample of samplePosts) {
    await upsertSamplePost(sample);
  }
}

async function upsertSamplePost(sample: (typeof samplePosts)[number]) {
  const category = await prisma.category.upsert({
    where: { slug: toSlug(sample.category) },
    update: { name: sample.category },
    create: { name: sample.category, slug: toSlug(sample.category) },
  });
  const tags = await Promise.all(sample.tags.map(upsertTag));

  const post = await prisma.post.upsert({
    where: { slug: toSlug(sample.title) },
    update: {},
    create: {
      title: sample.title,
      slug: toSlug(sample.title),
      excerpt: createExcerpt(sample.content, sample.title),
      content: sample.content,
      status: "PUBLISHED",
      publishedAt: SAMPLE_DATE,
      readingMinutes: estimateReadingMinutes(sample.content),
      categoryId: category.id,
      tags: { create: tags.map((tag) => ({ tag: { connect: { id: tag.id } } })) },
    },
    include: { category: true, tags: { include: { tag: true } } },
  });

  const currentRecipe = currentGlyphRecipeSchema.safeParse(post.glyphRecipe);
  const hasCurrentRecipe = currentRecipe.success && post.glyphSourceHash === currentRecipe.data.sourceHash;

  if (post.coverMode === "GLYPH" && !hasCurrentRecipe) {
    const persistedTags = post.tags.map(({ tag }) => tag);
    const recipe = createArticleGlyphRecipe({
      category: post.category?.slug ?? null,
      labels: {
        category: post.category?.name ?? null,
        tags: persistedTags.map((tag) => tag.name),
      },
      postId: post.id,
      signals: createArticleGlyphSignals(post.content),
      tags: persistedTags.map((tag) => tag.slug).sort(),
      title: post.title,
    });

    const update = await prisma.post.updateMany({
      where: { id: post.id, updatedAt: post.updatedAt },
      data: {
        glyphGeneratedAt: new Date(),
        glyphRecipe: recipe as unknown as Prisma.InputJsonValue,
        glyphSourceHash: recipe.sourceHash,
        updatedAt: post.updatedAt,
      },
    });

    if (update.count !== 1) {
      throw new Error(`Post changed while seeding its Glyph cover: ${post.id}`);
    }
  }
}

async function upsertTag(name: string) {
  return prisma.tag.upsert({
    where: { slug: toSlug(name) },
    update: { name },
    create: { name, slug: toSlug(name) },
  });
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for prisma seed.`);
  }

  return value;
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
