import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireAdmin: vi.fn().mockResolvedValue({}) }));

import {
  createPostPreviewLink,
  deletePostWithState,
  restorePostRevision,
  togglePostStatus,
  togglePostStatusWithState,
  updatePost,
  updatePostWithState,
} from "@/app/admin/posts/actions";
import { hashPostPreviewToken } from "@/lib/post-preview";
import { createPostRevisionSnapshot, toRevisionJson } from "@/lib/post-revisions";
import { POST_WRITE_CONFLICT_MESSAGE } from "@/lib/post-workflow";
import { prisma } from "@/lib/prisma";

let createdPostIds: string[] = [];
let createdTagIds: string[] = [];

afterEach(async () => {
  await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } });
  await prisma.tag.deleteMany({ where: { id: { in: createdTagIds } } });
  createdPostIds = [];
  createdTagIds = [];
});

describe("post workflow integration", () => {
  test("upserts one preview credential per post and revokes the previous link", async () => {
    const post = await createWorkflowPost();
    const first = await createPostPreviewLink({ status: "idle" }, createIdForm(post.id));
    const second = await createPostPreviewLink(first, createIdForm(post.id));

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
    if (first.status !== "success" || second.status !== "success") return;

    const stored = await prisma.postPreviewToken.findMany({ where: { postId: post.id } });
    const firstToken = first.href.split("/").at(-1) ?? "";
    const secondToken = second.href.split("/").at(-1) ?? "";

    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(hashPostPreviewToken(secondToken));
    expect(stored[0]?.tokenHash).not.toBe(hashPostPreviewToken(firstToken));
  });

  test("keeps one valid credential when preview links are generated concurrently", async () => {
    const post = await createWorkflowPost();
    const [first, second] = await Promise.all([
      createPostPreviewLink({ status: "idle" }, createIdForm(post.id)),
      createPostPreviewLink({ status: "idle" }, createIdForm(post.id)),
    ]);

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
    if (first.status !== "success" || second.status !== "success") return;

    const stored = await prisma.postPreviewToken.findMany({ where: { postId: post.id } });
    const generatedHashes = [first, second].map(({ href }) => (
      hashPostPreviewToken(href.split("/").at(-1) ?? "")
    ));
    expect(stored).toHaveLength(1);
    expect(generatedHashes).toContain(stored[0]?.tokenHash);
  });

  test("rejects a stale edit and rolls back its revision", async () => {
    const post = await createWorkflowPost();
    await prisma.post.update({
      where: { id: post.id },
      data: {
        excerpt: "Changed elsewhere",
        updatedAt: new Date(post.updatedAt.getTime() + 1_000),
      },
    });

    await expect(updatePost(createPostForm(post, post.updatedAt))).rejects.toThrow(POST_WRITE_CONFLICT_MESSAGE);
    await expect(updatePostWithState(
      { status: "idle" },
      createPostForm(post, post.updatedAt),
    )).resolves.toEqual({ message: POST_WRITE_CONFLICT_MESSAGE, status: "error" });

    const [stored, revisionCount] = await Promise.all([
      prisma.post.findUniqueOrThrow({ where: { id: post.id } }),
      prisma.postRevision.count({ where: { postId: post.id } }),
    ]);
    expect(stored.excerpt).toBe("Changed elsewhere");
    expect(revisionCount).toBe(0);
  });

  test("returns actionable conflicts for stale row actions", async () => {
    const post = await createWorkflowPost();
    await prisma.post.update({
      data: { updatedAt: new Date(post.updatedAt.getTime() + 1_000) },
      where: { id: post.id },
    });
    const staleForm = createIdForm(post.id);
    staleForm.set("expectedUpdatedAt", post.updatedAt.toISOString());

    await expect(togglePostStatusWithState({ status: "idle" }, staleForm))
      .resolves.toEqual({ message: POST_WRITE_CONFLICT_MESSAGE, status: "error" });
    await expect(deletePostWithState({ status: "idle" }, staleForm))
      .resolves.toEqual({ message: POST_WRITE_CONFLICT_MESSAGE, status: "error" });
    expect(await prisma.post.findUnique({ where: { id: post.id } })).not.toBeNull();
  });

  test("publishes a draft through toggle without touching its content", async () => {
    const post = await createWorkflowPost();
    const formData = createIdForm(post.id);
    formData.set("expectedUpdatedAt", post.updatedAt.toISOString());

    await togglePostStatus(formData);

    const published = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
    expect(published.content).toBe(post.content);
  });

  test("updates a post through the editor form and records a revision", async () => {
    const post = await createWorkflowPost();
    const formData = createPostForm(post, post.updatedAt);
    formData.set("title", "Updated title");
    formData.set("status", "PUBLISHED");

    await updatePost(formData);

    const [stored, revisionCount] = await Promise.all([
      prisma.post.findUniqueOrThrow({ where: { id: post.id } }),
      prisma.postRevision.count({ where: { postId: post.id } }),
    ]);
    expect(stored.title).toBe("Updated title");
    expect(stored.status).toBe("PUBLISHED");
    expect(revisionCount).toBe(1);
  });

  test("restores historical taxonomy without renaming a shared tag", async () => {
    const tag = await createTag("Current shared name", `shared-${randomUUID()}`);
    const post = await createWorkflowPost(tag.id);
    const revision = await createHistoricalRevision({
      postId: post.id,
      slug: `restored-${randomUUID()}`,
      tag: { ...tag, name: "Historical tag name" },
    });

    await restorePostRevision(createRestoreForm(post.id, revision.id, post.updatedAt));

    const [storedPost, storedTag] = await Promise.all([
      prisma.post.findUniqueOrThrow({
        where: { id: post.id },
        include: { tags: { include: { tag: true } } },
      }),
      prisma.tag.findUniqueOrThrow({ where: { id: tag.id } }),
    ]);
    expect(storedPost.title).toBe("Historical title");
    expect(storedPost.tags.map(({ tag: restoredTag }) => restoredTag.id)).toEqual([tag.id]);
    expect(storedTag.name).toBe("Current shared name");
  });

  test("rejects restore when its historical slug belongs to another post", async () => {
    const post = await createWorkflowPost();
    const conflicting = await createWorkflowPost();
    const revision = await createHistoricalRevision({
      postId: post.id,
      slug: conflicting.slug,
      tag: null,
    });

    await expect(restorePostRevision(createRestoreForm(post.id, revision.id, post.updatedAt)))
      .rejects.toThrow(/Slug.+另一篇文章/);
    expect(await prisma.postRevision.count({ where: { postId: post.id } })).toBe(1);
  });
});

async function createWorkflowPost(tagId?: string) {
  const suffix = randomUUID();
  const post = await prisma.post.create({
    data: {
      content: "## Current\n\nCurrent content.",
      excerpt: "Current excerpt",
      readingMinutes: 1,
      slug: `workflow-${suffix}`,
      status: "DRAFT",
      tags: tagId ? { create: [{ tagId }] } : undefined,
      title: "Current title",
    },
  });
  createdPostIds.push(post.id);
  return post;
}

async function createTag(name: string, slug: string) {
  const tag = await prisma.tag.create({ data: { name, slug } });
  createdTagIds.push(tag.id);
  return tag;
}

async function createHistoricalRevision(options: {
  readonly postId: string;
  readonly slug: string;
  readonly tag: { readonly id: string; readonly name: string; readonly slug: string } | null;
}) {
  const snapshot = createPostRevisionSnapshot({
    category: null,
    content: "## Historical\n\nHistorical content.",
    excerpt: "Historical excerpt",
    publishedAt: null,
    readingMinutes: 1,
    seoDescription: null,
    seoTitle: null,
    slug: options.slug,
    status: "DRAFT",
    tags: options.tag ? [{ tag: options.tag }] : [],
    title: "Historical title",
  });

  return prisma.postRevision.create({
    data: { postId: options.postId, reason: "SAVE", snapshot: toRevisionJson(snapshot) },
  });
}

function createIdForm(id: string) {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

function createPostForm(post: { readonly id: string; readonly slug: string; readonly title: string }, updatedAt: Date) {
  const formData = createIdForm(post.id);
  formData.set("expectedUpdatedAt", updatedAt.toISOString());
  formData.set("title", post.title);
  formData.set("slug", post.slug);
  formData.set("excerpt", "Stale edit");
  formData.set("content", "## Stale\n\nStale content.");
  formData.set("categoryId", "");
  formData.set("tagNames", "");
  formData.set("seoTitle", "");
  formData.set("seoDescription", "");
  formData.set("status", "DRAFT");
  return formData;
}

function createRestoreForm(postId: string, revisionId: string, updatedAt: Date) {
  const formData = createIdForm(postId);
  formData.set("revisionId", revisionId);
  formData.set("expectedUpdatedAt", updatedAt.toISOString());
  return formData;
}
