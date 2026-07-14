"use client";

import { useActionState, useEffect, useRef } from "react";

import { addComment, type CommentFormState } from "@/app/(public)/posts/[slug]/actions";
import { ButtonStateContent } from "@/components/button-state-content";

type CommentFormProps = {
  readonly onClearReply?: () => void;
  readonly onSubmitted?: () => void;
  readonly parentId?: string;
  readonly postId: string;
  readonly replyTo?: string;
  readonly slug: string;
};

const initialState: CommentFormState = {
  message: "",
  ok: false,
};

export function CommentForm(props: CommentFormProps) {
  const { onClearReply, onSubmitted, parentId, postId, replyTo, slug } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(addComment, initialState);

  useEffect(() => {
    if (!state.ok) {
      return;
    }

    formRef.current?.reset();
    onSubmitted?.();
  }, [onSubmitted, state.ok]);

  return (
    <form action={formAction} className="comment-form" ref={formRef}>
      <input name="postId" type="hidden" value={postId} />
      <input name="slug" type="hidden" value={slug} />
      {parentId ? <input name="parentId" type="hidden" value={parentId} /> : null}
      <label className="comment-form__website">
        Website
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>
      {replyTo ? <ReplyTargetNotice onClearReply={onClearReply} replyTo={replyTo} /> : null}
      <div className="form-grid">
        <label>
          昵称
          <input name="author" required />
        </label>
        <label>
          邮箱
          <input name="email" required type="email" />
        </label>
      </div>
      <label>
        评论
        <textarea name="body" required rows={5} />
      </label>
      <p aria-live="polite" className="form-success" hidden={!state.ok || !state.message}>
        {state.ok ? state.message : ""}
      </p>
      <p className="form-error" hidden={state.ok || !state.message} role="alert">
        {!state.ok ? state.message : ""}
      </p>
      <button aria-busy={pending} className="button button--primary" disabled={pending} type="submit">
        <ButtonStateContent pending={pending} pendingChildren="提交中">
          提交审核
        </ButtonStateContent>
      </button>
    </form>
  );
}

function ReplyTargetNotice({ onClearReply, replyTo }: { readonly onClearReply?: () => void; readonly replyTo: string }) {
  return (
    <div className="comment-form__reply-target">
      <span>正在回复 {replyTo}</span>
      <button className="button button--ghost" onClick={onClearReply} type="button">
        取消回复
      </button>
    </div>
  );
}
