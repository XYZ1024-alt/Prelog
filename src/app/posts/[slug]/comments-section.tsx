"use client";

import { useCallback, useRef, useState } from "react";

import { CommentForm } from "@/app/posts/[slug]/comment-form";

export type CommentNode = {
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
  readonly id: string;
  readonly parentId: string | null;
  readonly replies: CommentNode[];
};

type ReplyTarget = {
  readonly author: string;
  readonly id: string;
};

type CommentsSectionProps = {
  readonly comments: readonly CommentNode[];
  readonly postId: string;
  readonly slug: string;
};

export function CommentsSection({ comments, postId, slug }: CommentsSectionProps) {
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const clearReplyTarget = useCallback(() => setReplyTarget(null), []);

  function handleReply(target: ReplyTarget) {
    setReplyTarget(target);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    requestAnimationFrame(() => formAnchorRef.current?.scrollIntoView({ behavior, block: "start" }));
  }

  return (
    <section className="comments">
      <h2>评论</h2>
      <p className="comments__notice">评论提交后会进入审核，通过后展示。邮箱不会公开。</p>
      <div ref={formAnchorRef}>
        <CommentForm
          key={replyTarget?.id ?? "root"}
          onClearReply={clearReplyTarget}
          onSubmitted={clearReplyTarget}
          parentId={replyTarget?.id}
          postId={postId}
          replyTo={replyTarget?.author}
          slug={slug}
        />
      </div>
      <div className="comment-list">
        {comments.map((comment) => (
          <CommentThread comment={comment} key={comment.id} onReply={handleReply} />
        ))}
      </div>
      {comments.length === 0 ? <p className="empty-state">暂无评论，欢迎留下第一条想法。</p> : null}
    </section>
  );
}

function CommentThread({ comment, onReply }: { readonly comment: CommentNode; readonly onReply: (target: ReplyTarget) => void }) {
  return (
    <article className="comment">
      <div className="comment__body">
        <div className="comment__meta">
          <strong>{comment.author}</strong>
          <time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time>
        </div>
        <p>{comment.body}</p>
        <button className="comment__reply" onClick={() => onReply({ author: comment.author, id: comment.id })} type="button">
          回复
        </button>
      </div>
      {comment.replies.length > 0 ? (
        <div className="comment__replies">
          {comment.replies.map((reply) => (
            <CommentThread comment={reply} key={reply.id} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
