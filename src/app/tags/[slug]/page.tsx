import { notFound } from "next/navigation";

import { AnimatedPage } from "@/components/animated-page";
import { PostCard } from "@/components/post-card";
import { TypographicAscii } from "@/components/typographic-ascii";
import { prisma } from "@/lib/prisma";
import { decodeRouteSegment } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = await prisma.tag.findUnique({
    where: { slug: decodeRouteSegment(slug) },
    include: {
      posts: {
        include: {
          post: {
            include: {
              category: true,
              tags: { include: { tag: true } },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });

  if (!tag) {
    notFound();
  }

  const posts = tag.posts
    .map(({ post }) => post)
    .filter((post) => post.status === "PUBLISHED")
    .sort((a, b) => Number(b.publishedAt) - Number(a.publishedAt));

  if (posts.length === 0) {
    notFound();
  }

  return (
    <AnimatedPage>
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
    </AnimatedPage>
  );
}
