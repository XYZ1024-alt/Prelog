import { ExternalLink, ListFilter } from "lucide-react";
import Link from "next/link";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { toAdminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type AdminTagsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminTagsPage({ searchParams }: AdminTagsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const tags = await prisma.tag.findMany({
    where: {
      posts: { some: {} },
      ...(query ? { OR: createTagKeywordFilters(query) } : {}),
    },
    include: {
      _count: { select: { posts: true } },
      posts: {
        take: 3,
        orderBy: { post: { updatedAt: "desc" } },
        include: {
          post: {
            select: { title: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return (
    <AdminShell>
      <AdminPageHeader label="内容组织" title="标签概览" />
      <form className="admin-filters admin-filters--compact">
          <label className="sr-only" htmlFor="admin-tag-search">搜索标签</label>
          <input defaultValue={query} id="admin-tag-search" name="q" placeholder="搜索标签名或 slug" type="search" />
          <SubmitButton className="button button--ghost" pendingChildren="筛选中...">
            筛选
          </SubmitButton>
      </form>
      <div className="admin-table">
          {tags.map((tag) => (
            <article className="admin-row" key={tag.id}>
              <div>
                <strong>{tag.name}</strong>
                <span>
                  /tags/{tag.slug} · {tag._count.posts} 篇文章
                </span>
                <p className="admin-row__note">{tag.posts.map(({ post }) => post.title).join(" · ")}</p>
              </div>
              <div className="admin-row__actions">
                <Link className="button button--ghost" href={`/tags/${tag.slug}`}>
                  <ExternalLink aria-hidden="true" size={15} />
                  查看前台
                </Link>
                <Link className="button button--ghost" href={toAdminPath(`/posts?tag=${encodeURIComponent(tag.slug)}`)}>
                  <ListFilter aria-hidden="true" size={15} />
                  查看相关文章
                </Link>
              </div>
            </article>
          ))}
          {tags.length === 0 ? (
            <p className="empty-state">{query ? "没有匹配标签，换个关键词试试。" : "当前还没有正在使用的标签。"}</p>
          ) : null}
      </div>
    </AdminShell>
  );
}

function createTagKeywordFilters(query: string) {
  return [
    { name: { contains: query, mode: "insensitive" as const } },
    { slug: { contains: query, mode: "insensitive" as const } },
  ];
}
