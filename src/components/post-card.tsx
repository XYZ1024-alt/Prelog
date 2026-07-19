import Link from "next/link";
import { CalendarDays, MessageCircle, Timer } from "lucide-react";

type PostWithMeta = {
  readonly _count: { readonly comments: number };
  readonly category: { readonly name: string; readonly slug: string } | null;
  readonly excerpt: string;
  readonly id: string;
  readonly publishedAt: Date | null;
  readonly readingMinutes: number;
  readonly slug: string;
  readonly tags: readonly { readonly tag: { readonly name: string; readonly slug: string } }[];
  readonly title: string;
};

export function PostCard({ post }: { readonly post: PostWithMeta }) {
  const date = post.publishedAt?.toLocaleDateString("zh-CN") ?? "未发布";

  return (
    <article className="post-card">
      <div className="post-card__body">
        <div className="post-card__meta">
          {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : null}
          <span>
            <CalendarDays size={14} />
            {date}
          </span>
        </div>
        <h2 className="post-card__title">
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.excerpt}</p>
        <div className="post-card__foot">
          <span>
            <Timer size={14} />
            {post.readingMinutes} 分钟
          </span>
          <span>
            <MessageCircle size={14} />
            {post._count.comments} 评论
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
