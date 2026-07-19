"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { toAdminPath } from "@/lib/admin-path";
import { createPostMutationCacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { createPostPreviewToken } from "@/lib/post-preview";
import {
  POST_WRITE_CONFLICT_MESSAGE,
  type PostMutationState,
  type PostPreviewLinkState,
} from "@/lib/post-workflow";
import {
  createPostRevisionAuditJson,
  parsePostRevisionSnapshot,
} from "@/lib/post-revisions";
import { requireAdmin } from "@/lib/session";
import { createExcerpt, estimateReadingMinutes, toSlug } from "@/lib/text";
import { idSchema, postFormSchema } from "@/lib/validation";

const TAG_SEPARATOR = ",";
const PUBLISHED_STATUS = "PUBLISHED";
const POST_REVISION_RETENTION_LIMIT = 50;
const expectedUpdatedAtSchema = z.iso.datetime();

type ParsedPostForm = ReturnType<typeof parsePostForm>;
type CanonicalTag = { readonly id: string; readonly name: string; readonly slug: string };
type CanonicalCategory = { readonly id: string; readonly name: string; readonly slug: string } | null;
type RevalidationTarget = {
  readonly categorySlug: string | null;
  readonly slug: string;
  readonly tagSlugs: readonly string[];
};

export async function createPost(formData: FormData) {
  await requireAdmin();
  const parsed = parsePostForm(formData);
  const result = await prisma.$transaction(async (transaction) => {
    const category = await getCanonicalCategory(transaction, parsed.categoryId);
    const tags = await upsertCanonicalTags(transaction, parsed.tagNames);
    const post = await transaction.post.create({
      data: {
        ...postData(parsed),
        tags: { create: createTagConnections(tags) },
      },
    });

    return {
      id: post.id,
      target: createRevalidationTarget({ category, slug: post.slug, tags }),
    };
  });

  revalidateContent([result.target]);
  redirect(toAdminPath(`/posts/${result.id}/edit`));
}

export async function updatePost(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const expectedUpdatedAt = parseExpectedUpdatedAt(formData);
  const parsed = parsePostForm(formData);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.post.findUniqueOrThrow({
      where: { id },
      include: { category: true, tags: { include: { tag: true } } },
    });
    assertPostVersion(existing.updatedAt, expectedUpdatedAt);
    const category = await getCanonicalCategory(transaction, parsed.categoryId);
    const tags = await upsertCanonicalTags(transaction, parsed.tagNames);

    await createRevision(transaction, id, existing, getSaveRevisionReason(existing.status, parsed.status));
    const update = await transaction.post.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: postData(parsed, existing.publishedAt),
    });
    assertSinglePostWrite(update.count);
    await replacePostTags(transaction, id, tags);
    await deleteUnusedTags(transaction);

    return {
      current: createRevalidationTarget({ category, slug: parsed.slug, tags }),
      previous: createRevalidationTarget({
        category: existing.category,
        slug: existing.slug,
        tags: existing.tags.map(({ tag }) => tag),
      }),
    };
  });

  revalidateContent([result.previous, result.current]);
  redirect(toAdminPath("/posts"));
}

export async function updatePostWithState(
  _previousState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  return runPostMutationWithState(() => updatePost(formData));
}

export async function createPostWithState(
  _previousState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  return runPostMutationWithState(() => createPost(formData));
}

export async function togglePostStatus(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const expectedUpdatedAt = parseExpectedUpdatedAt(formData);
  const result = await prisma.$transaction(async (transaction) => {
    const post = await transaction.post.findUniqueOrThrow({
      where: { id },
      include: { category: true, tags: { include: { tag: true } } },
    });
    assertPostVersion(post.updatedAt, expectedUpdatedAt);
    const status = post.status === PUBLISHED_STATUS ? "DRAFT" : PUBLISHED_STATUS;

    await createRevision(transaction, post.id, post, status === PUBLISHED_STATUS ? "PUBLISH" : "SAVE");

    const update = await transaction.post.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: {
        publishedAt: status === PUBLISHED_STATUS ? (post.publishedAt ?? new Date()) : post.publishedAt,
        status,
      },
    });
    assertSinglePostWrite(update.count);

    return createRevalidationTarget({
      category: post.category,
      slug: post.slug,
      tags: post.tags.map(({ tag }) => tag),
    });
  });

  revalidateContent([result]);
}

export async function togglePostStatusWithState(
  _previousState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  return runPostMutationWithState(() => togglePostStatus(formData));
}

export async function createPostPreviewLink(
  _previousState: PostPreviewLinkState,
  formData: FormData,
): Promise<PostPreviewLinkState> {
  await requireAdmin();
  const parsedId = idSchema.safeParse({ id: formData.get("id") });

  if (!parsedId.success) {
    return { message: "无法识别要预览的文章。", status: "error" };
  }

  const id = parsedId.data.id;
  const preview = createPostPreviewToken();

  await prisma.$transaction(async (transaction) => {
    const post = await transaction.post.findUnique({ where: { id }, select: { id: true } });

    if (!post) {
      throw new Error("无法为不存在的文章生成预览链接。");
    }

    await transaction.postPreviewToken.upsert({
      where: { postId: id },
      update: {
        createdAt: new Date(),
        expiresAt: preview.expiresAt,
        tokenHash: preview.tokenHash,
      },
      create: {
        expiresAt: preview.expiresAt,
        postId: id,
        tokenHash: preview.tokenHash,
      },
    });
  });

  return {
    expiresAt: preview.expiresAt.toISOString(),
    href: `/preview/posts/${preview.token}`,
    status: "success",
  };
}

export async function restorePostRevision(formData: FormData) {
  await requireAdmin();
  const postId = idSchema.parse({ id: formData.get("id") }).id;
  const revisionId = idSchema.parse({ id: formData.get("revisionId") }).id;
  const expectedUpdatedAt = parseExpectedUpdatedAt(formData);
  const result = await prisma.$transaction(async (transaction) => {
    const post = await transaction.post.findUniqueOrThrow({
      where: { id: postId },
      include: { category: true, tags: { include: { tag: true } } },
    });
    const revision = await transaction.postRevision.findFirstOrThrow({
      where: { id: revisionId, postId },
    });
    assertPostVersion(post.updatedAt, expectedUpdatedAt);
    const snapshot = parsePostRevisionSnapshot(revision.snapshot);
    await assertRestoredSlugAvailable(transaction, postId, snapshot.slug);
    const category = await getRestoredCategory(transaction, snapshot.category?.id ?? null);
    const tags = await upsertSnapshotTags(transaction, snapshot.tags);

    await createRevision(transaction, postId, post, "RESTORE");
    const update = await transaction.post.updateMany({
      where: { id: postId, updatedAt: expectedUpdatedAt },
      data: createRestoredPostData({ category, snapshot }),
    });
    assertSinglePostWrite(update.count);
    await replacePostTags(transaction, postId, tags);
    await deleteUnusedTags(transaction);

    return {
      current: createRevalidationTarget({ category, slug: snapshot.slug, tags }),
      previous: createRevalidationTarget({
        category: post.category,
        slug: post.slug,
        tags: post.tags.map(({ tag }) => tag),
      }),
    };
  });

  revalidateContent([result.previous, result.current]);
  redirect(toAdminPath(`/posts/${postId}/edit?revision=restored`));
}

export async function restorePostRevisionWithState(
  _previousState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  return runPostMutationWithState(() => restorePostRevision(formData));
}

export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const expectedUpdatedAt = parseExpectedUpdatedAt(formData);
  const target = await prisma.$transaction(async (transaction) => {
    const post = await transaction.post.findUniqueOrThrow({
      where: { id },
      include: { category: true, tags: { include: { tag: true } } },
    });
    assertPostVersion(post.updatedAt, expectedUpdatedAt);
    const deletion = await transaction.post.deleteMany({ where: { id, updatedAt: expectedUpdatedAt } });
    assertSinglePostWrite(deletion.count);
    await deleteUnusedTags(transaction);

    return createRevalidationTarget({
      category: post.category,
      slug: post.slug,
      tags: post.tags.map(({ tag }) => tag),
    });
  });

  revalidateContent([target]);
}

export async function deletePostWithState(
  _previousState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  return runPostMutationWithState(() => deletePost(formData));
}

function parsePostForm(formData: FormData) {
  const rawSlug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");

  return postFormSchema.parse({
    title,
    slug: toSlug(rawSlug || title),
    excerpt: formData.get("excerpt"),
    content: formData.get("content"),
    categoryId: formData.get("categoryId"),
    tagNames: formData.get("tagNames"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    status: formData.get("status"),
  });
}

function postData(parsed: ParsedPostForm, existingPublishedAt: Date | null = null) {
  return {
    categoryId: parsed.categoryId || null,
    content: parsed.content,
    excerpt: parsed.excerpt || createExcerpt(parsed.content, parsed.title),
    publishedAt: parsed.status === PUBLISHED_STATUS ? (existingPublishedAt ?? new Date()) : existingPublishedAt,
    readingMinutes: estimateReadingMinutes(parsed.content),
    seoDescription: parsed.seoDescription || null,
    seoTitle: parsed.seoTitle || null,
    slug: parsed.slug,
    status: parsed.status,
    title: parsed.title,
  };
}

async function getCanonicalCategory(transaction: Prisma.TransactionClient, categoryId?: string) {
  if (!categoryId) {
    return null;
  }

  return transaction.category.findUniqueOrThrow({ where: { id: categoryId } });
}

async function upsertCanonicalTags(transaction: Prisma.TransactionClient, tagNames?: string) {
  const names = normalizeTagNames(tagNames);
  const tags: CanonicalTag[] = [];

  for (const { name, slug } of names) {
    tags.push(
      await transaction.tag.upsert({
        where: { slug },
        update: { name },
        create: { name, slug },
      }),
    );
  }

  return tags;
}

function normalizeTagNames(tagNames?: string) {
  const namesBySlug = new Map<string, string>();

  for (const rawName of (tagNames ?? "").split(TAG_SEPARATOR)) {
    const name = rawName.trim();

    if (!name) {
      continue;
    }

    const slug = toSlug(name);

    if (!slug) {
      throw new Error(`Tag cannot be converted to a slug: ${name}`);
    }

    if (!namesBySlug.has(slug)) {
      namesBySlug.set(slug, name);
    }
  }

  return Array.from(namesBySlug, ([slug, name]) => ({ name, slug }));
}

function createTagConnections(tags: readonly CanonicalTag[]) {
  return tags.map((tag) => ({ tag: { connect: { id: tag.id } } }));
}

async function replacePostTags(
  transaction: Prisma.TransactionClient,
  postId: string,
  tags: readonly CanonicalTag[],
) {
  await transaction.postTag.deleteMany({ where: { postId } });

  if (tags.length === 0) {
    return;
  }

  await transaction.postTag.createMany({
    data: tags.map((tag) => ({ postId, tagId: tag.id })),
  });
}

async function createRevision(
  transaction: Prisma.TransactionClient,
  postId: string,
  post: Parameters<typeof createPostRevisionAuditJson>[0],
  reason: "PUBLISH" | "RESTORE" | "SAVE",
) {
  await transaction.postRevision.create({
    data: { postId, reason, snapshot: createPostRevisionAuditJson(post) },
  });
  const staleRevisions = await transaction.postRevision.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    skip: POST_REVISION_RETENTION_LIMIT,
    select: { id: true },
  });

  if (staleRevisions.length > 0) {
    await transaction.postRevision.deleteMany({
      where: { id: { in: staleRevisions.map(({ id }) => id) } },
    });
  }
}

function getSaveRevisionReason(previous: "DRAFT" | "PUBLISHED", next: "DRAFT" | "PUBLISHED") {
  return previous !== PUBLISHED_STATUS && next === PUBLISHED_STATUS ? "PUBLISH" as const : "SAVE" as const;
}

async function getRestoredCategory(transaction: Prisma.TransactionClient, categoryId: string | null) {
  if (!categoryId) return null;
  const category = await transaction.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Cannot restore a revision whose category has been deleted.");
  return category;
}

async function upsertSnapshotTags(
  transaction: Prisma.TransactionClient,
  tags: readonly { readonly name: string; readonly slug: string }[],
) {
  const restored: CanonicalTag[] = [];

  for (const tag of tags) {
    restored.push(await transaction.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: { name: tag.name, slug: tag.slug },
    }));
  }

  return restored;
}

function createRestoredPostData(options: {
  readonly category: CanonicalCategory;
  readonly snapshot: ReturnType<typeof parsePostRevisionSnapshot>;
}) {
  const { category, snapshot } = options;
  return {
    categoryId: category?.id ?? null,
    content: snapshot.content,
    excerpt: snapshot.excerpt,
    publishedAt: toOptionalDate(snapshot.publishedAt),
    readingMinutes: snapshot.readingMinutes,
    seoDescription: snapshot.seoDescription,
    seoTitle: snapshot.seoTitle,
    slug: snapshot.slug,
    status: snapshot.status,
    title: snapshot.title,
  };
}

function toOptionalDate(value: string | null) {
  return value ? new Date(value) : null;
}

function parseExpectedUpdatedAt(formData: FormData) {
  const value = expectedUpdatedAtSchema.parse(formData.get("expectedUpdatedAt"));
  return new Date(value);
}

function assertPostVersion(actual: Date, expected: Date) {
  if (actual.getTime() !== expected.getTime()) {
    throw new Error(POST_WRITE_CONFLICT_MESSAGE);
  }
}

function assertSinglePostWrite(count: number) {
  if (count !== 1) {
    throw new Error(POST_WRITE_CONFLICT_MESSAGE);
  }
}

async function runPostMutationWithState<Result>(
  action: () => Promise<Result>,
  createSuccessState: (result: Result) => PostMutationState = () => ({ status: "idle" }),
): Promise<PostMutationState> {
  try {
    return createSuccessState(await action());
  } catch (error) {
    if (error instanceof Error && error.message === POST_WRITE_CONFLICT_MESSAGE) {
      return { message: POST_WRITE_CONFLICT_MESSAGE, status: "error" };
    }

    if (error instanceof z.ZodError) {
      return {
        message: error.issues[0]?.message ?? "提交内容未通过校验。",
        status: "error",
      };
    }

    throw error;
  }
}

async function assertRestoredSlugAvailable(
  transaction: Prisma.TransactionClient,
  postId: string,
  slug: string,
) {
  const conflict = await transaction.post.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (conflict && conflict.id !== postId) {
    throw new Error(`无法恢复版本：Slug “${slug}” 已被另一篇文章使用。`);
  }
}

function createRevalidationTarget(options: {
  readonly category: CanonicalCategory;
  readonly slug: string;
  readonly tags: readonly CanonicalTag[];
}): RevalidationTarget {
  return {
    categorySlug: options.category?.slug ?? null,
    slug: options.slug,
    tagSlugs: options.tags.map((tag) => tag.slug),
  };
}

function revalidateContent(targets: readonly RevalidationTarget[]) {
  createPostMutationCacheTags(targets).forEach((tag) => updateTag(tag));
  revalidatePath("/admin/posts");
}

async function deleteUnusedTags(transaction: Prisma.TransactionClient) {
  await transaction.tag.deleteMany({ where: { posts: { none: {} } } });
}
