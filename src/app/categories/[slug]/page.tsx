import { notFound } from "next/navigation";

import { AnimatedPage } from "@/components/animated-page";
import { PostCard } from "@/components/post-card";
import { TypographicAscii } from "@/components/typographic-ascii";
import { prisma } from "@/lib/prisma";
import { decodeRouteSegment } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug: decodeRouteSegment(slug) },
    include: {
      posts: {
        where: { status: "PUBLISHED" },
        include: {
          category: true,
          tags: { include: { tag: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!category) {
    notFound();
  }

  return (
    <AnimatedPage>
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
    </AnimatedPage>
  );
}
