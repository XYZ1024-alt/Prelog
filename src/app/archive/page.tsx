import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { getPublishedPostArchivePage } from "@/lib/posts";
import { createPageMetadataAlternates } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: createPageMetadataAlternates("/archive"),
  description: "按发布时间浏览 Prelog 的全部已发布文章。",
  title: "文章归档",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type ArchivePageProps = {
  readonly searchParams: Promise<{ readonly cursor?: string }>;
};

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const cursor = (await searchParams).cursor?.trim();
  const archive = await getPublishedPostArchivePage({ cursor });

  if (!archive) {
    notFound();
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="eyebrow"><Archive size={16} /> Archive</span>
        <h1>文章归档</h1>
        <p>从最新一篇开始，沿着时间线浏览所有已发布的写作记录。</p>
      </section>
      {archive.posts.length > 0 ? (
        <ol className="archive-list">
          {archive.posts.map((post) => (
            <li className="archive-entry" key={post.id}>
              <time dateTime={post.publishedAt?.toISOString()}>{formatDate(post.publishedAt)}</time>
              <div>
                <div className="archive-entry__meta">
                  {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : null}
                  <span>{post.readingMinutes} 分钟</span>
                  <span>{post._count.comments} 评论</span>
                </div>
                <h2><Link href={`/posts/${post.slug}`}>{post.title}</Link></h2>
                <p>{post.excerpt}</p>
              </div>
              <Link aria-label={`阅读 ${post.title}`} href={`/posts/${post.slug}`}>
                <ArrowUpRight size={20} />
              </Link>
            </li>
          ))}
        </ol>
      ) : <p className="empty-state">暂无已发布文章。</p>}
      <ArchivePagination cursor={cursor} nextCursor={archive.nextCursor} />
    </PageShell>
  );
}

function ArchivePagination({ cursor, nextCursor }: {
  readonly cursor: string | undefined;
  readonly nextCursor: string | null;
}) {
  if (!cursor && !nextCursor) {
    return null;
  }

  return (
    <nav aria-label="文章归档分页" className="content-pagination">
      {cursor ? <Link href="/archive"><ArrowLeft size={16} />回到最新</Link> : <span />}
      <span>按发布时间倒序</span>
      {nextCursor ? (
        <Link href={`/archive?cursor=${encodeURIComponent(nextCursor)}`}>
          更早文章<ArrowRight size={16} />
        </Link>
      ) : <span />}
    </nav>
  );
}

function formatDate(date: Date | null) {
  return date ? DATE_FORMATTER.format(date) : "日期未注明";
}
