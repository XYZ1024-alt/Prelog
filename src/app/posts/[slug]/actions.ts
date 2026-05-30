"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { moderateComment } from "@/lib/comment-moderation";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";

export async function addComment(formData: FormData) {
  const parsed = commentSchema.parse({
    postId: formData.get("postId"),
    slug: formData.get("slug"),
    parentId: formData.get("parentId"),
    author: formData.get("author"),
    email: formData.get("email"),
    body: formData.get("body"),
    website: formData.get("website"),
  });
  const requestHeaders = await headers();
  const moderation = moderateComment({
    body: parsed.body,
    email: parsed.email,
    ip: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "",
    website: parsed.website,
  });

  await prisma.comment.create({
    data: {
      postId: parsed.postId,
      parentId: parsed.parentId || null,
      author: parsed.author,
      email: parsed.email,
      body: parsed.body,
      ...moderation,
    },
  });

  revalidatePath(`/posts/${parsed.slug}`);
}

function getClientIp(headersList: Headers) {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? "";
}
