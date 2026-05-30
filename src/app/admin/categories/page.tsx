import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminNav } from "@/app/admin/admin-nav";
import { deleteCategory } from "@/app/admin/categories/actions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({
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
          <Link className="button button--primary" href="/admin/categories/new">
            <Plus size={16} />
            新建分类
          </Link>
        </div>
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
                <Link className="button button--ghost" href={`/admin/categories/${category.id}/edit`}>
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
          {categories.length === 0 ? <p className="empty-state">还没有分类，先新建一个分类。</p> : null}
        </div>
      </section>
    </main>
  );
}
