"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { createExcerpt, estimateReadingMinutes, toSlug } from "@/lib/text";
import { idSchema, postFormSchema } from "@/lib/validation";

const TAG_SEPARATOR = ",";

export async function createPost(formData: FormData) {
  await requireAdmin();
  const parsed = parsePostForm(formData);
  const post = await prisma.post.create({
    data: {
      ...postData(parsed),
      tags: { create: await tagLinks(parsed.tagNames) },
    },
  });

  revalidateContent();
  redirect(`/admin/posts/${post.id}/edit`);
}

export async function updatePost(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const parsed = parsePostForm(formData);

  await prisma.$transaction([
    prisma.postTag.deleteMany({ where: { postId: id } }),
    prisma.post.update({
      where: { id },
      data: {
        ...postData(parsed),
        tags: { create: await tagLinks(parsed.tagNames) },
      },
    }),
  ]);
  await deleteUnusedTags();

  revalidateContent();
  redirect("/admin/posts");
}

export async function togglePostStatus(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const post = await prisma.post.findUniqueOrThrow({ where: { id } });
  const status = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

  await prisma.post.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : null },
  });

  revalidateContent();
}

export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  await prisma.post.delete({ where: { id } });
  await deleteUnusedTags();
  revalidateContent();
}

function parsePostForm(formData: FormData) {
  const rawSlug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");

  return postFormSchema.parse({
    title,
    slug: toSlug(rawSlug || title),
    excerpt: formData.get("excerpt"),
    content: formData.get("content"),
    coverImage: formData.get("coverImage"),
    categoryId: formData.get("categoryId"),
    tagNames: formData.get("tagNames"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    status: formData.get("status"),
  });
}

function postData(parsed: ReturnType<typeof parsePostForm>) {
  const excerpt = parsed.excerpt || createExcerpt(parsed.content);
  const publishedAt = parsed.status === "PUBLISHED" ? new Date() : null;

  return {
    title: parsed.title,
    slug: parsed.slug,
    excerpt,
    content: parsed.content,
    coverImage: parsed.coverImage || null,
    categoryId: parsed.categoryId || null,
    seoTitle: parsed.seoTitle || null,
    seoDescription: parsed.seoDescription || null,
    status: parsed.status,
    publishedAt,
    readingMinutes: estimateReadingMinutes(parsed.content),
  };
}

async function tagLinks(tagNames?: string) {
  const names = normalizeTagNames(tagNames);
  const tags = await Promise.all(
    names.map((name) =>
      prisma.tag.upsert({
        where: { slug: toSlug(name) },
        update: { name },
        create: { name, slug: toSlug(name) },
      }),
    ),
  );

  return tags.map((tag) => ({ tag: { connect: { id: tag.id } } }));
}

function normalizeTagNames(tagNames?: string) {
  return Array.from(
    new Set(
      (tagNames ?? "")
        .split(TAG_SEPARATOR)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );
}

function revalidateContent() {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin/posts");
}

async function deleteUnusedTags() {
  await prisma.tag.deleteMany({
    where: {
      posts: {
        none: {},
      },
    },
  });
}
