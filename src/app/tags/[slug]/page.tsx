import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/post-card";
import { TypographicAscii } from "@/components/typographic-ascii";
import { getTagWithPublishedPosts } from "@/lib/posts";
import { createPageMetadataAlternates } from "@/lib/site-url";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = await getTagWithPublishedPosts((await params).slug);
  if (!tag || tag.posts.length === 0) {
    return {};
  }

  return {
    alternates: createPageMetadataAlternates(`/tags/${encodeURIComponent(tag.slug)}`),
    description: `浏览 Prelog 中标记为 ${tag.name} 的已发布文章。`,
    title: `#${tag.name}`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;
  const tag = await getTagWithPublishedPosts(slug);

  if (!tag) {
    notFound();
  }

  const posts = tag.posts
    .map(({ post }) => post)
    .sort((left, right) => {
      const rightTime = (right.publishedAt ?? right.createdAt).getTime();
      const leftTime = (left.publishedAt ?? left.createdAt).getTime();
      return rightTime - leftTime || right.id.localeCompare(left.id);
    });

  if (posts.length === 0) {
    notFound();
  }

  return (
    <PageShell>
      <section className="page-heading">
        <TypographicAscii text={tag.name} tone="compact" />
        <span className="eyebrow">Tag</span>
        <h1>#{tag.name}</h1>
      </section>
      <div className="post-grid page-post-grid">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </PageShell>
  );
}
