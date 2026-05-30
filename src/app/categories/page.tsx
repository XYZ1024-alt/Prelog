import type { Metadata } from "next";
import Link from "next/link";

import { AnimatedPage } from "@/components/animated-page";
import { TypographicAscii } from "@/components/typographic-ascii";
import { getCategoriesWithCounts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分类",
  description: "按分类浏览 Prelog 的文章。",
};

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();
  const visibleCategories = categories.filter((category) => category._count.posts > 0);

  return (
    <AnimatedPage>
      <section className="page-heading">
        <TypographicAscii text="Categories" tone="compact" />
        <span className="eyebrow">Categories</span>
        <h1>分类</h1>
        <p>按主题浏览文章，从项目实践、设计判断到工具和工程记录。</p>
      </section>
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
    </AnimatedPage>
  );
}
