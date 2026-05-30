import Link from "next/link";

import { AdminNav } from "@/app/admin/admin-nav";
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
      posts: {
        some: {},
      },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { posts: true } },
      posts: {
        take: 3,
        orderBy: { post: { updatedAt: "desc" } },
        include: {
          post: {
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <span className="eyebrow">Tags</span>
            <h1>标签概览</h1>
          </div>
        </div>
        <form className="admin-filters admin-filters--compact">
          <input defaultValue={query} name="q" placeholder="搜索标签名称或 slug" type="search" />
          <button className="button button--ghost" type="submit">
            筛选
          </button>
        </form>
        <div className="admin-table">
          {tags.map((tag) => (
            <article className="admin-row" key={tag.id}>
              <div>
                <strong>{tag.name}</strong>
                <span>
                  /tags/{tag.slug} · {tag._count.posts} 篇文章
                </span>
                <p className="admin-row__note">
                  {tag.posts.map(({ post }) => post.title).join(" · ")}
                </p>
              </div>
              <div className="admin-row__actions">
                <Link className="button button--ghost" href={`/tags/${tag.slug}`}>
                  查看前台
                </Link>
                {tag.posts[0] ? (
                  <Link className="button button--ghost" href={`/admin/posts/${tag.posts[0].post.id}/edit`}>
                    查看相关文章
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {tags.length === 0 ? <p className="empty-state">{query ? "没有匹配标签，换个关键词试试。" : "当前还没有正在使用的标签。"}</p> : null}
        </div>
      </section>
    </main>
  );
}
