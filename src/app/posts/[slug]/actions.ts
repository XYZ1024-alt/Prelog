"use server";

import { headers } from "next/headers";

import { moderateComment } from "@/lib/comment-moderation";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, type RateLimitPolicy } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { commentSchema } from "@/lib/validation";

export type CommentFormState = {
  readonly code?: "RATE_LIMITED";
  readonly message: string;
  readonly ok: boolean;
  readonly retryAfterSeconds?: number;
  readonly status?: number;
};

const COMMENT_GLOBAL_POLICY: RateLimitPolicy = {
  limit: 12,
  windowMs: 30 * 60 * 1000,
};
const COMMENT_POST_POLICY: RateLimitPolicy = {
  limit: 4,
  windowMs: 10 * 60 * 1000,
};

export async function addComment(_state: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const requestHeaders = await headers();
  const identity = getRequestIdentity(requestHeaders, "comment");
  const globalLimit = await consumeRateLimit({
    ...COMMENT_GLOBAL_POLICY,
    key: `comment:global:${identity.hash}`,
  });

  if (!globalLimit.allowed) {
    return createRateLimitedState(globalLimit.retryAfterSeconds);
  }

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

  const postLimit = await consumeRateLimit({
    ...COMMENT_POST_POLICY,
    key: `comment:post:${parsed.data.postId}:${identity.hash}`,
  });

  if (!postLimit.allowed) {
    return createRateLimitedState(postLimit.retryAfterSeconds);
  }

  const target = await getCommentTarget(parsed.data.postId, parsed.data.slug, parsed.data.parentId);

  if (!target.ok) {
    return { message: target.message, ok: false };
  }

  const moderation = moderateComment({
    body: parsed.data.body,
    email: parsed.data.email,
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

function createRateLimitedState(retryAfterSeconds: number): CommentFormState {
  return {
    code: "RATE_LIMITED",
    message: `提交过于频繁，请在 ${retryAfterSeconds} 秒后重试。`,
    ok: false,
    retryAfterSeconds,
    status: 429,
  };
}
