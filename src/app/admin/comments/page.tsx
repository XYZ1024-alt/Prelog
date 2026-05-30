import Link from "next/link";

import { AdminNav } from "@/app/admin/admin-nav";
import { approveComment, deleteComment, hideComment, markCommentSpam } from "@/app/admin/comments/actions";
import type { CommentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  await requireAdmin();
  const comments = await prisma.comment.findMany({
    include: {
      parent: { select: { author: true } },
      post: { select: { title: true, slug: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const counts = getStatusCounts(comments);

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <span className="eyebrow">Comments</span>
            <h1>评论审核</h1>
          </div>
          <div className="admin-comment-stats">
            <span>待审核 {counts.PENDING}</span>
            <span>已通过 {counts.APPROVED}</span>
            <span>隐藏 {counts.HIDDEN}</span>
            <span>垃圾 {counts.SPAM}</span>
          </div>
        </div>

        <div className="admin-table">
          {comments.map((comment) => (
            <article className="admin-row admin-row--comment" key={comment.id}>
              <div>
                <strong>{comment.author}</strong>
                <span>
                  {getCommentStatusLabel(comment.status)} · {comment.post.title}
                  {comment.parent ? ` · 回复 ${comment.parent.author}` : ""}
                </span>
                <p>{comment.body}</p>
                <p className="admin-row__note">
                  {comment.email} · 垃圾分 {comment.spamScore} · {comment.createdAt.toLocaleString("zh-CN")}
                  {comment.moderationNote ? ` · ${comment.moderationNote}` : ""}
                </p>
              </div>
              <div className="admin-row__actions">
                <Link className="button button--ghost" href={`/posts/${comment.post.slug}`}>
                  查看
                </Link>
                <StatusAction action={approveComment} hidden={comment.status === "APPROVED"} id={comment.id} label="通过" />
                <StatusAction action={hideComment} hidden={comment.status === "HIDDEN"} id={comment.id} label="隐藏" />
                <StatusAction action={markCommentSpam} hidden={comment.status === "SPAM"} id={comment.id} label="垃圾" />
                <form action={deleteComment}>
                  <input name="id" type="hidden" value={comment.id} />
                  <button className="button button--danger" type="submit">
                    删除
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatusAction({
  action,
  hidden,
  id,
  label,
}: {
  readonly action: (formData: FormData) => Promise<void>;
  readonly hidden: boolean;
  readonly id: string;
  readonly label: string;
}) {
  if (hidden) {
    return null;
  }

  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <button className="button button--ghost" type="submit">
        {label}
      </button>
    </form>
  );
}

function getStatusCounts(comments: readonly { readonly status: CommentStatus }[]) {
  return comments.reduce(
    (counts, comment) => ({ ...counts, [comment.status]: counts[comment.status] + 1 }),
    { APPROVED: 0, HIDDEN: 0, PENDING: 0, SPAM: 0 } satisfies Record<CommentStatus, number>,
  );
}

function getCommentStatusLabel(status: CommentStatus) {
  const labels: Record<CommentStatus, string> = {
    APPROVED: "已通过",
    HIDDEN: "已隐藏",
    PENDING: "待审核",
    SPAM: "垃圾",
  };

  return labels[status];
}
