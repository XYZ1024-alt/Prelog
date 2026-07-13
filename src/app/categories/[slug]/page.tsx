import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/post-card";
import { TypographicAscii } from "@/components/typographic-ascii";
import { getCategoryWithPublishedPosts } from "@/lib/posts";
import { createPageMetadataAlternates } from "@/lib/site-url";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await getCategoryWithPublishedPosts((await params).slug);
  if (!category) {
    return {};
  }

  return {
    alternates: createPageMetadataAlternates(`/categories/${encodeURIComponent(category.slug)}`),
    description: category.description ?? `浏览 Prelog 中关于${category.name}的已发布文章。`,
    title: category.name,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategoryWithPublishedPosts(slug);

  if (!category) {
    notFound();
  }

  return (
    <PageShell>
      <section className="page-heading">
        <TypographicAscii text={category.name} tone="compact" />
        <span className="eyebrow">Category</span>
        <h1>{category.name}</h1>
        {category.description ? <p>{category.description}</p> : null}
      </section>
      <div className="post-grid page-post-grid">
        {category.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </PageShell>
  );
}
