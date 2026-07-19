import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleHero } from "@/components/article-hero";
import { ArticleToc } from "@/components/article-toc";
import { MarkdownContent } from "@/components/markdown-content";
import { getMarkdownHeadings } from "@/lib/markdown-headings";
import { hashPostPreviewToken } from "@/lib/post-preview";
import { prisma } from "@/lib/prisma";
import { createArticleDescription, stripLeadingTitleHeading } from "@/lib/text";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  readonly params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "文章预览",
};

export default async function PostPreviewPage({ params }: PreviewPageProps) {
  const { token } = await params;
  const preview = await getPreview(token);
  if (!preview) notFound();

  const post = preview.post;
  const content = stripLeadingTitleHeading(post.content, post.title);
  const headings = getMarkdownHeadings(content);

  return (
    <main className="article-shell article-preview">
      <div className="article-preview__banner" role="status">
        <strong>未发布预览</strong>
        <span>此链接会在 {formatExpiry(preview.expiresAt)} 失效，页面不会被搜索引擎收录。</span>
      </div>
      <ArticleHero
        category={post.category}
        commentCount={0}
        excerpt={createArticleDescription({ excerpt: post.excerpt, title: post.title })}
        publishedAt={post.publishedAt}
        readingMinutes={post.readingMinutes}
        tags={post.tags.map(({ tag }) => tag)}
        title={post.title}
      />
      <div className="article-layout">
        <div className="article-main">
          <MarkdownContent content={content} />
        </div>
        <ArticleToc headings={headings} />
      </div>
    </main>
  );
}

async function getPreview(token: string) {
  let tokenHash: string;
  try {
    tokenHash = hashPostPreviewToken(token);
  } catch {
    return null;
  }

  return prisma.postPreviewToken.findFirst({
    where: { expiresAt: { gt: new Date() }, tokenHash },
    include: {
      post: {
        include: { category: true, tags: { include: { tag: true } } },
      },
    },
  });
}

function formatExpiry(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
