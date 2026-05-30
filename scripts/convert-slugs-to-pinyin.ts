import "dotenv/config";

import { prisma } from "../src/lib/prisma.ts";
import { toSlug } from "../src/lib/text.ts";

type SlugRecord = {
  id: string;
  slug: string;
};

const SLUG_SUFFIX_SEPARATOR = "-";

async function main() {
  await convertPostSlugs();
  await convertCategorySlugs();
  await convertTagSlugs();
}

async function convertPostSlugs() {
  const posts = await prisma.post.findMany({ select: { id: true, title: true, slug: true } });
  const updates = createSlugUpdates(posts, (post) => post.title);

  for (const update of updates) {
    await prisma.post.update({ where: { id: update.id }, data: { slug: update.slug } });
    console.log(`Post: ${update.from} -> ${update.slug}`);
  }
}

async function convertCategorySlugs() {
  const categories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } });
  const updates = createSlugUpdates(categories, (category) => category.name);

  for (const update of updates) {
    await prisma.category.update({ where: { id: update.id }, data: { slug: update.slug } });
    console.log(`Category: ${update.from} -> ${update.slug}`);
  }
}

async function convertTagSlugs() {
  const tags = await prisma.tag.findMany({ select: { id: true, name: true, slug: true } });
  const updates = createSlugUpdates(tags, (tag) => tag.name);

  for (const update of updates) {
    await prisma.tag.update({ where: { id: update.id }, data: { slug: update.slug } });
    console.log(`Tag: ${update.from} -> ${update.slug}`);
  }
}

function createSlugUpdates<T extends SlugRecord>(records: T[], getSource: (record: T) => string) {
  const used = new Set<string>();

  return records.map((record) => {
    const baseSlug = toSlug(getSource(record));
    const slug = makeUniqueSlug(baseSlug, used);
    used.add(slug);

    return { id: record.id, from: record.slug, slug };
  });
}

function makeUniqueSlug(baseSlug: string, used: Set<string>) {
  let slug = baseSlug;
  let suffix = 2;

  while (used.has(slug)) {
    slug = `${baseSlug}${SLUG_SUFFIX_SEPARATOR}${suffix}`;
    suffix += 1;
  }

  return slug;
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
