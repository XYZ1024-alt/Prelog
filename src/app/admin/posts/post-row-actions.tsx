"use client";

import { useActionState, type FormEvent } from "react";
import Link from "next/link";

import {
  deletePostWithState,
  togglePostStatusWithState,
} from "@/app/admin/posts/actions";
import { SubmitButton } from "@/components/submit-button";
import type { PostMutationState } from "@/lib/post-workflow";

const INITIAL_STATE: PostMutationState = { status: "idle" };

export function PostRowActions({
  editHref,
  id,
  status,
  updatedAt,
}: {
  readonly editHref: string;
  readonly id: string;
  readonly status: "DRAFT" | "PUBLISHED";
  readonly updatedAt: string;
}) {
  return (
    <div className="admin-row__actions">
      <Link className="button button--ghost" href={editHref}>编辑</Link>
      <ToggleStatusForm id={id} status={status} updatedAt={updatedAt} />
      <DeletePostForm id={id} updatedAt={updatedAt} />
    </div>
  );
}

function ToggleStatusForm({ id, status, updatedAt }: {
  readonly id: string;
  readonly status: "DRAFT" | "PUBLISHED";
  readonly updatedAt: string;
}) {
  const [state, action] = useActionState(togglePostStatusWithState, INITIAL_STATE);

  return (
    <div>
      <form action={action}>
        <PostIdentityFields id={id} updatedAt={updatedAt} />
        <SubmitButton className="button button--ghost" pendingChildren="处理中...">
          {status === "PUBLISHED" ? "撤回" : "发布"}
        </SubmitButton>
      </form>
      <MutationError state={state} />
    </div>
  );
}

function DeletePostForm({ id, updatedAt }: { readonly id: string; readonly updatedAt: string }) {
  const [state, action] = useActionState(deletePostWithState, INITIAL_STATE);

  return (
    <div>
      <form action={action} onSubmit={confirmPostDeletion}>
        <PostIdentityFields id={id} updatedAt={updatedAt} />
        <SubmitButton className="button button--danger" pendingChildren="删除中...">删除</SubmitButton>
      </form>
      <MutationError state={state} />
    </div>
  );
}

function PostIdentityFields({ id, updatedAt }: { readonly id: string; readonly updatedAt: string }) {
  return (
    <>
      <input name="id" type="hidden" value={id} />
      <input name="expectedUpdatedAt" type="hidden" value={updatedAt} />
    </>
  );
}

function MutationError({ state }: { readonly state: PostMutationState }) {
  return (
    <p className="form-error" hidden={state.status !== "error"} role="alert">
      {state.status === "error" ? state.message : ""}
    </p>
  );
}

function confirmPostDeletion(event: FormEvent<HTMLFormElement>) {
  if (!window.confirm("确定删除这篇文章吗？版本历史和评论也会一起删除。")) {
    event.preventDefault();
  }
}
