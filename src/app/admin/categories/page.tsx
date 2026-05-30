import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminNav } from "@/app/admin/admin-nav";
import { deleteCategory } from "@/app/admin/categories/actions";
import { toAdminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type AdminCategoriesPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const categories = await prisma.category.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { posts: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <span className="eyebrow">Categories</span>
            <h1>分类管理</h1>
          </div>
          <Link className="button button--primary" href={toAdminPath("/categories/new")}>
            <Plus size={16} />
            新建分类
          </Link>
        </div>
        <form className="admin-filters admin-filters--compact">
          <input defaultValue={query} name="q" placeholder="搜索分类名称、slug 或描述" type="search" />
          <button className="button button--ghost" type="submit">
            筛选
          </button>
        </form>
        <div className="admin-table">
          {categories.map((category) => (
            <article className="admin-row" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <span>
                  /categories/{category.slug} · {category._count.posts} 篇文章
                </span>
                {category.description ? <p className="admin-row__note">{category.description}</p> : null}
              </div>
              <div className="admin-row__actions">
                <Link className="button button--ghost" href={toAdminPath(`/categories/${category.id}/edit`)}>
                  编辑
                </Link>
                <form action={deleteCategory}>
                  <input name="id" type="hidden" value={category.id} />
                  <button className="button button--danger" type="submit">
                    删除
                  </button>
                </form>
              </div>
            </article>
          ))}
          {categories.length === 0 ? <p className="empty-state">{query ? "没有匹配分类，换个关键词试试。" : "还没有分类，先新建一个分类。"}</p> : null}
        </div>
      </section>
    </main>
  );
}
