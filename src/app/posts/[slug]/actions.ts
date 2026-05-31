"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { moderateComment } from "@/lib/comment-moderation";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";

export type CommentFormState = {
  readonly message: string;
  readonly ok: boolean;
};

export async function addComment(_state: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const parsed = commentSchema.safeParse({
    postId: formData.get("postId"),
    slug: formData.get("slug"),
    parentId: formData.get("parentId") ?? "",
    author: formData.get("author"),
    email: formData.get("email"),
    body: formData.get("body"),
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return { message: "请检查昵称、邮箱和评论内容后再提交。", ok: false };
  }

  const target = await getCommentTarget(parsed.data.postId, parsed.data.slug, parsed.data.parentId);

  if (!target.ok) {
    return { message: target.message, ok: false };
  }

  const requestHeaders = await headers();
  const moderation = moderateComment({
    body: parsed.data.body,
    email: parsed.data.email,
    ip: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "",
    website: parsed.data.website,
  });

  await prisma.comment.create({
    data: {
      postId: parsed.data.postId,
      parentId: parsed.data.parentId || null,
      author: parsed.data.author,
      email: parsed.data.email,
      body: parsed.data.body,
      ...moderation,
    },
  });

  revalidatePath(`/posts/${parsed.data.slug}`);
  return { message: "评论已提交，审核通过后会显示。", ok: true };
}

async function getCommentTarget(postId: string, slug: string, parentId?: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, slug, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!post) {
    return { message: "文章不存在或暂时不可评论。", ok: false } as const;
  }

  if (!parentId) {
    return { ok: true } as const;
  }

  const parent = await prisma.comment.findFirst({
    where: { id: parentId, postId },
    select: { id: true },
  });

  if (!parent) {
    return { message: "要回复的评论不存在。", ok: false } as const;
  }

  return { ok: true } as const;
}

function getClientIp(headersList: Headers) {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? "";
}
