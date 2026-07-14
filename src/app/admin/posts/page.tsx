import Link from "next/link";
import { Plus } from "lucide-react";
import type { PostStatus } from "@/generated/prisma/client";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { PostRowActions } from "@/app/admin/posts/post-row-actions";
import { SubmitButton } from "@/components/submit-button";
import { toAdminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{ q?: string; status?: PostStatus | "ALL"; tag?: string }>;
};

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const tag = params.tag?.trim() ?? "";
  const status = parseStatus(params.status);
  const posts = await prisma.post.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
      ...(query ? { OR: createKeywordFilters(query) } : {}),
    },
    include: { category: true, _count: { select: { comments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AdminShell>
      <AdminPageHeader
        actions={(
          <Link className="button button--primary" href={toAdminPath("/posts/new")}>
            <Plus size={16} />
            新建文章
          </Link>
        )}
        label="内容管理"
        title="文章管理"
      />
      <form className="admin-filters">
          <label className="sr-only" htmlFor="admin-post-search">搜索文章</label>
          <input defaultValue={query} id="admin-post-search" name="q" placeholder="搜索标题、slug 或摘要" type="search" />
          <input name="tag" type="hidden" value={tag} />
          <label className="sr-only" htmlFor="admin-post-status">文章状态</label>
          <select defaultValue={status} id="admin-post-status" name="status">
            <option value="ALL">全部状态</option>
            <option value="PUBLISHED">已发布</option>
            <option value="DRAFT">草稿</option>
          </select>
          <SubmitButton className="button button--ghost" pendingChildren="筛选中...">
            筛选
          </SubmitButton>
      </form>
      {tag ? (
          <p className="admin-row__note">
            当前按标签筛选：<strong>{tag}</strong>{" "}
            <Link href={toAdminPath("/posts")}>清除筛选</Link>
          </p>
      ) : null}
      <div className="admin-table">
          {posts.map((post) => (
            <article className="admin-row" key={post.id}>
              <div>
                <strong>{post.title}</strong>
                <span>
                  {getPostStatusLabel(post.status)} · {post.category?.name ?? "未分类"} · {post._count.comments} 条评论
                </span>
              </div>
              <PostRowActions
                editHref={toAdminPath(`/posts/${post.id}/edit`)}
                id={post.id}
                status={post.status}
                updatedAt={post.updatedAt.toISOString()}
              />
            </article>
          ))}
          {posts.length === 0 ? <p className="empty-state">没有匹配文章，换个关键词或状态试试。</p> : null}
      </div>
    </AdminShell>
  );
}

function parseStatus(status?: PostStatus | "ALL") {
  return status === "DRAFT" || status === "PUBLISHED" ? status : "ALL";
}

function createKeywordFilters(query: string) {
  return [
    { title: { contains: query, mode: "insensitive" as const } },
    { slug: { contains: query, mode: "insensitive" as const } },
    { excerpt: { contains: query, mode: "insensitive" as const } },
  ];
}

function getPostStatusLabel(status: string) {
  return status === "PUBLISHED" ? "已发布" : "草稿";
}
