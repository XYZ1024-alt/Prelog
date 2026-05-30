import Link from "next/link";
import { Plus } from "lucide-react";
import type { PostStatus } from "@/generated/prisma/client";

import { AdminNav } from "@/app/admin/admin-nav";
import { deletePost, togglePostStatus } from "@/app/admin/posts/actions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{ q?: string; status?: PostStatus | "ALL" }>;
};

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status === "DRAFT" || params.status === "PUBLISHED" ? params.status : "ALL";
  const posts = await prisma.post.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { excerpt: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { category: true, _count: { select: { comments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <span className="eyebrow">Posts</span>
            <h1>文章管理</h1>
          </div>
          <Link className="button button--primary" href="/admin/posts/new">
            <Plus size={16} />
            新建文章
          </Link>
        </div>
        <form className="admin-filters">
          <input defaultValue={query} name="q" placeholder="搜索标题、slug 或摘要" type="search" />
          <select defaultValue={status} name="status">
            <option value="ALL">全部状态</option>
            <option value="PUBLISHED">已发布</option>
            <option value="DRAFT">草稿</option>
          </select>
          <button className="button button--ghost" type="submit">
            筛选
          </button>
        </form>
        <div className="admin-table">
          {posts.map((post) => (
            <article className="admin-row" key={post.id}>
              <div>
                <strong>{post.title}</strong>
                <span>
                  {getPostStatusLabel(post.status)} · {post.category?.name ?? "未分类"} · {post._count.comments} 评论
                </span>
              </div>
              <div className="admin-row__actions">
                <Link className="button button--ghost" href={`/admin/posts/${post.id}/edit`}>
                  编辑
                </Link>
                <form action={togglePostStatus}>
                  <input name="id" type="hidden" value={post.id} />
                  <button className="button button--ghost" type="submit">
                    {post.status === "PUBLISHED" ? "撤回" : "发布"}
                  </button>
                </form>
                <form action={deletePost}>
                  <input name="id" type="hidden" value={post.id} />
                  <button className="button button--danger" type="submit">
                    删除
                  </button>
                </form>
              </div>
            </article>
          ))}
          {posts.length === 0 ? <p className="empty-state">没有匹配文章，换个关键词或状态试试。</p> : null}
        </div>
      </section>
    </main>
  );
}

function getPostStatusLabel(status: string) {
  return status === "PUBLISHED" ? "已发布" : "草稿";
}
