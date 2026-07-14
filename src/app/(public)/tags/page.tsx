import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { PageShell } from "@/components/page-shell";
import { getTagsWithCounts } from "@/lib/posts";
import { createPageMetadataAlternates } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: createPageMetadataAlternates("/tags"),
  title: "标签",
  description: "按标签浏览 Prelog 的文章。",
};

export default async function TagsPage() {
  const tags = await getTagsWithCounts();

  return (
    <PageShell>
      <PageHeading
        description="用更细的关键词浏览文章，快速找到相关主题和实践记录。"
        label="关键词导航"
        title="文章标签"
      />
      <div className="taxonomy-index taxonomy-index--tags">
        {tags.map((tag) => (
          <Link className="tag" href={`/tags/${tag.slug}`} key={tag.slug}>
            {tag.name} · {tag._count.posts}
          </Link>
        ))}
      </div>
      {tags.length === 0 ? <p className="empty-state">暂无标签。</p> : null}
    </PageShell>
  );
}
