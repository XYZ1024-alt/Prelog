import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { deleteCategory } from "@/app/admin/categories/actions";
import { SubmitButton } from "@/components/submit-button";
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
    <AdminShell>
      <AdminPageHeader
        actions={(
          <Link className="button button--primary" href={toAdminPath("/categories/new")}>
            <Plus size={16} />
            新建分类
          </Link>
        )}
        label="内容组织"
        title="分类管理"
      />
      <form className="admin-filters admin-filters--compact">
          <label className="sr-only" htmlFor="admin-category-search">搜索分类</label>
          <input defaultValue={query} id="admin-category-search" name="q" placeholder="搜索分类名称、slug 或描述" type="search" />
          <SubmitButton className="button button--ghost" pendingChildren="筛选中...">
            筛选
          </SubmitButton>
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
                  <Pencil aria-hidden="true" size={15} />
                  编辑
                </Link>
                <form action={deleteCategory}>
                  <input name="id" type="hidden" value={category.id} />
                  <SubmitButton className="button button--danger" pendingChildren="删除中...">
                    <Trash2 aria-hidden="true" size={15} />
                    删除
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))}
          {categories.length === 0 ? <p className="empty-state">{query ? "没有匹配分类，换个关键词试试。" : "还没有分类，先新建一个分类。"}</p> : null}
      </div>
    </AdminShell>
  );
}
