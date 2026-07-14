import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { PageShell } from "@/components/page-shell";
import { getCategoriesWithCounts } from "@/lib/posts";
import { createPageMetadataAlternates } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: createPageMetadataAlternates("/categories"),
  title: "分类",
  description: "按分类浏览 Prelog 的文章。",
};

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();
  const visibleCategories = categories.filter((category) => category._count.posts > 0);

  return (
    <PageShell>
      <PageHeading
        description="按主题浏览文章，从项目实践、设计判断到工具和工程记录。"
        label="主题导航"
        title="文章分类"
      />
      <div className="taxonomy-index">
        {visibleCategories.map((category) => (
          <Link className="taxonomy-index__item" href={`/categories/${category.slug}`} key={category.slug}>
            <strong>{category.name}</strong>
            <span>{category._count.posts} 篇文章</span>
            {category.description ? <p>{category.description}</p> : null}
          </Link>
        ))}
      </div>
      {visibleCategories.length === 0 ? <p className="empty-state">暂无分类。</p> : null}
    </PageShell>
  );
}
