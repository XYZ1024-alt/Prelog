import type { Prisma } from "@/generated/prisma/client";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MessageCircle, Timer } from "lucide-react";

import { ArticleGlyph } from "@/components/article-glyph";
import { PretextFitTitle } from "@/components/pretext-fit-title";
import { resolvePostCover } from "@/lib/post-cover";

type PostWithMeta = {
  readonly _count: { readonly comments: number };
  readonly category: { readonly name: string; readonly slug: string } | null;
  readonly coverImage: string | null;
  readonly coverMode: "GLYPH" | "MANUAL";
  readonly excerpt: string;
  readonly glyphRecipe: Prisma.JsonValue | null;
  readonly glyphSourceHash: string | null;
  readonly id: string;
  readonly publishedAt: Date | null;
  readonly readingMinutes: number;
  readonly slug: string;
  readonly tags: readonly { readonly tag: { readonly name: string; readonly slug: string } }[];
  readonly title: string;
};

export function PostCard({ post }: { readonly post: PostWithMeta }) {
  const date = post.publishedAt?.toLocaleDateString("zh-CN") ?? "未发布";
  const cover = resolvePostCover(post);

  return (
    <article className="post-card">
      <Link aria-label={`阅读 ${post.title}`} className="post-card__media" href={`/posts/${post.slug}`}>
        {cover.mode === "MANUAL" ? (
          <Image
            alt=""
            className="post-card__image"
            fill
            referrerPolicy="no-referrer"
            sizes="(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 33vw"
            src={cover.imageUrl}
            unoptimized
          />
        ) : (
          <span className="post-card-cover">
            <ArticleGlyph className="post-card-cover__glyph" preset="thumbnail" recipe={cover.recipe} />
          </span>
        )}
      </Link>
      <div className="post-card__body">
        <div className="post-card__meta">
          {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : null}
          <span>
            <CalendarDays size={14} />
            {date}
          </span>
        </div>
        <PretextFitTitle href={`/posts/${post.slug}`} title={post.title} />
        <p>{post.excerpt}</p>
        <div className="post-card__foot">
          <span>
            <Timer size={14} />
            {post.readingMinutes} 分钟
          </span>
          <span>
            <MessageCircle size={14} />
            {post._count.comments}
          </span>
        </div>
        <div className="tag-row">
          {post.tags.map(({ tag }) => (
            <Link className="tag" href={`/tags/${tag.slug}`} key={tag.slug}>
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
