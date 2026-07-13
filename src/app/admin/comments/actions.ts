"use server";

import { revalidatePath, updateTag } from "next/cache";

import type { CommentStatus } from "@/generated/prisma/client";
import { createCommentMutationCacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { idSchema } from "@/lib/validation";

export async function approveComment(formData: FormData) {
  await updateCommentStatus(formData, "APPROVED");
}

export async function hideComment(formData: FormData) {
  await updateCommentStatus(formData, "HIDDEN");
}

export async function markCommentSpam(formData: FormData) {
  await updateCommentStatus(formData, "SPAM");
}

export async function deleteComment(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const comment = await prisma.comment.delete({
    where: { id },
    include: { post: { select: { slug: true } } },
  });

  revalidateCommentPaths(comment.post.slug);
}

async function updateCommentStatus(formData: FormData, status: CommentStatus) {
  await requireAdmin();
  const id = idSchema.parse({ id: formData.get("id") }).id;
  const comment = await prisma.comment.update({
    where: { id },
    data: { status, moderationNote: `管理员设置为 ${status}` },
    include: { post: { select: { slug: true } } },
  });

  revalidateCommentPaths(comment.post.slug);
}

function revalidateCommentPaths(slug: string) {
  createCommentMutationCacheTags(slug).forEach((tag) => updateTag(tag));
  revalidatePath("/admin/comments");
}
