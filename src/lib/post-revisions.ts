import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";

const SNAPSHOT_VERSION = 1;

const taxonomySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const postRevisionSnapshotSchema = z
  .object({
    category: taxonomySchema.nullable(),
    content: z.string(),
    excerpt: z.string(),
    publishedAt: z.iso.datetime().nullable(),
    readingMinutes: z.number().int().positive(),
    seoDescription: z.string().nullable(),
    seoTitle: z.string().nullable(),
    slug: z.string().min(1),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    tags: z.array(taxonomySchema),
    title: z.string().min(1),
    version: z.literal(SNAPSHOT_VERSION),
  })
  .superRefine((snapshot, context) => {
    if (snapshot.status === "PUBLISHED" && !snapshot.publishedAt) {
      context.addIssue({
        code: "custom",
        message: "Published revisions require a publication date.",
        path: ["publishedAt"],
      });
    }
  });

export type PostRevisionSnapshot = z.infer<typeof postRevisionSnapshotSchema>;

type RevisionPostSource = {
  readonly category: { readonly id: string; readonly name: string; readonly slug: string } | null;
  readonly content: string;
  readonly excerpt: string;
  readonly publishedAt: Date | null;
  readonly readingMinutes: number;
  readonly seoDescription: string | null;
  readonly seoTitle: string | null;
  readonly slug: string;
  readonly status: "DRAFT" | "PUBLISHED";
  readonly tags: readonly { readonly tag: { readonly id: string; readonly name: string; readonly slug: string } }[];
  readonly title: string;
};

export function createPostRevisionSnapshot(post: RevisionPostSource): PostRevisionSnapshot {
  return postRevisionSnapshotSchema.parse(createPostRevisionSnapshotValue(post));
}

export function createPostRevisionAuditJson(post: RevisionPostSource): Prisma.InputJsonValue {
  const value = createPostRevisionSnapshotValue(post);
  const parsed = postRevisionSnapshotSchema.safeParse(value);

  if (parsed.success) {
    return toRevisionJson(parsed.data);
  }

  return {
    ...value,
    audit: {
      capturedInvalid: true,
      issues: parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.map(String).join("."),
      })),
    },
  } as unknown as Prisma.InputJsonValue;
}

function createPostRevisionSnapshotValue(post: RevisionPostSource) {
  return {
    category: post.category ? {
      id: post.category.id,
      name: post.category.name,
      slug: post.category.slug,
    } : null,
    content: post.content,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    readingMinutes: post.readingMinutes,
    seoDescription: post.seoDescription,
    seoTitle: post.seoTitle,
    slug: post.slug,
    status: post.status,
    tags: post.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    title: post.title,
    version: SNAPSHOT_VERSION,
  };
}

export function parsePostRevisionSnapshot(value: Prisma.JsonValue): PostRevisionSnapshot {
  return postRevisionSnapshotSchema.parse(value);
}

export function toRevisionJson(snapshot: PostRevisionSnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}
