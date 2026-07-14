import { Check, Eye, EyeOff, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { approveComment, deleteComment, hideComment, markCommentSpam } from "@/app/admin/comments/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CommentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type AdminCommentsPageProps = {
  searchParams: Promise<{ q?: string; status?: CommentStatus | "ALL" }>;
};

export default async function AdminCommentsPage({ searchParams }: AdminCommentsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = isCommentStatus(params.status) ? params.status : "ALL";
  const comments = await prisma.comment.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(query
        ? {
            OR: [
              { author: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { body: { contains: query, mode: "insensitive" } },
              { post: { title: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      parent: { select: { author: true } },
      post: { select: { title: true, slug: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const counts = getStatusCounts(comments);

  return (
    <AdminShell>
      <AdminPageHeader
        actions={(
          <div className="admin-comment-stats">
            <span>待审核 {counts.PENDING}</span>
            <span>已通过 {counts.APPROVED}</span>
            <span>隐藏 {counts.HIDDEN}</span>
            <span>垃圾 {counts.SPAM}</span>
          </div>
        )}
        label="内容管理"
        title="评论审核"
      />
      <form className="admin-filters">
          <label className="sr-only" htmlFor="admin-comment-search">搜索评论</label>
          <input defaultValue={query} id="admin-comment-search" name="q" placeholder="搜索作者、邮箱、评论或文章标题" type="search" />
          <label className="sr-only" htmlFor="admin-comment-status">评论状态</label>
          <select defaultValue={status} id="admin-comment-status" name="status">
            <option value="ALL">全部状态</option>
            <option value="PENDING">待审核</option>
            <option value="APPROVED">已通过</option>
            <option value="HIDDEN">隐藏</option>
            <option value="SPAM">垃圾</option>
          </select>
          <SubmitButton className="button button--ghost" pendingChildren="筛选中...">
            筛选
          </SubmitButton>
      </form>

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
                  <Eye aria-hidden="true" size={15} />
                  查看
                </Link>
                <StatusAction action={approveComment} hidden={comment.status === "APPROVED"} icon={Check} id={comment.id} label="通过" />
                <StatusAction action={hideComment} hidden={comment.status === "HIDDEN"} icon={EyeOff} id={comment.id} label="隐藏" />
                <StatusAction action={markCommentSpam} hidden={comment.status === "SPAM"} icon={ShieldAlert} id={comment.id} label="垃圾" />
                <form action={deleteComment}>
                  <input name="id" type="hidden" value={comment.id} />
                  <SubmitButton className="button button--danger" pendingChildren="删除中...">
                    <Trash2 aria-hidden="true" size={15} />
                    删除
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))}
          {comments.length === 0 ? <p className="empty-state">没有匹配评论，换个关键词或状态试试。</p> : null}
      </div>
    </AdminShell>
  );
}

function StatusAction({
  action,
  hidden,
  icon: Icon,
  id,
  label,
}: {
  readonly action: (formData: FormData) => Promise<void>;
  readonly hidden: boolean;
  readonly icon: typeof Check;
  readonly id: string;
  readonly label: string;
}) {
  if (hidden) {
    return null;
  }

  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <SubmitButton className="button button--ghost" pendingChildren="处理中...">
        <Icon aria-hidden="true" size={15} />
        {label}
      </SubmitButton>
    </form>
  );
}

function getStatusCounts(comments: readonly { readonly status: CommentStatus }[]) {
  const counts = { APPROVED: 0, HIDDEN: 0, PENDING: 0, SPAM: 0 } satisfies Record<CommentStatus, number>;

  comments.forEach((comment) => {
    counts[comment.status] += 1;
  });

  return counts;
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

function isCommentStatus(status: string | undefined): status is CommentStatus {
  return status === "APPROVED" || status === "HIDDEN" || status === "PENDING" || status === "SPAM";
}
