import type { Metadata } from "next";
import Link from "next/link";

import { AnimatedPage } from "@/components/animated-page";
import { TypographicAscii } from "@/components/typographic-ascii";
import { getTagsWithCounts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "标签",
  description: "按标签浏览 Prelog 的文章。",
};

export default async function TagsPage() {
  const tags = await getTagsWithCounts();

  return (
    <AnimatedPage>
      <section className="page-heading">
        <TypographicAscii text="Tags" tone="compact" />
        <span className="eyebrow">Tags</span>
        <h1>标签</h1>
        <p>用更细的关键词浏览文章，快速找到相关主题和实践记录。</p>
      </section>
      <div className="taxonomy-index taxonomy-index--tags">
        {tags.map((tag) => (
          <Link className="tag" href={`/tags/${tag.slug}`} key={tag.slug}>
            {tag.name} · {tag._count.posts}
          </Link>
        ))}
      </div>
      {tags.length === 0 ? <p className="empty-state">暂无标签。</p> : null}
    </AnimatedPage>
  );
}
