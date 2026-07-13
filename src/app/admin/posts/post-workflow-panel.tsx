"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, History, Link2, RotateCcw } from "lucide-react";

import {
  createPostPreviewLink,
  restorePostRevisionWithState,
} from "@/app/admin/posts/actions";
import { SubmitButton } from "@/components/submit-button";
import type { PostMutationState, PostPreviewLinkState } from "@/lib/post-workflow";

type RevisionSummary = {
  readonly createdAt: string;
  readonly id: string;
  readonly reason: "PUBLISH" | "RESTORE" | "SAVE";
  readonly restorable: boolean;
  readonly status: "DRAFT" | "PUBLISHED" | null;
  readonly title: string;
};

const INITIAL_PREVIEW_STATE: PostPreviewLinkState = { status: "idle" };
const INITIAL_MUTATION_STATE: PostMutationState = { status: "idle" };

export function PostWorkflowPanel({
  expectedUpdatedAt,
  postId,
  revisions,
}: {
  readonly expectedUpdatedAt: string;
  readonly postId: string;
  readonly revisions: readonly RevisionSummary[];
}) {
  const [previewState, previewAction] = useActionState(createPostPreviewLink, INITIAL_PREVIEW_STATE);

  return (
    <section className="admin-card post-workflow">
      <div className="admin-card__head">
        <div>
          <h2>发布工作流</h2>
          <span>分享预览与服务端版本恢复</span>
        </div>
        <form action={previewAction}>
          <input name="id" type="hidden" value={postId} />
          <SubmitButton className="button button--ghost" pendingChildren="生成中...">
            <Link2 size={15} />
            生成预览链接
          </SubmitButton>
        </form>
      </div>
      <PreviewLinkResult key={previewState.status === "success" ? previewState.href : previewState.status} state={previewState} />
      <div className="post-workflow__history">
        <div className="post-workflow__history-title">
          <History size={16} />
          <strong>最近版本</strong>
        </div>
        {revisions.map((revision) => (
          <article className="post-workflow__revision" key={revision.id}>
            <div>
              <strong>{revision.title}</strong>
              <span>
                {formatRevisionReason(revision.reason)} · {formatRevisionStatus(revision)} · {formatDateTime(revision.createdAt)}
              </span>
              {!revision.restorable ? <span role="alert">快照校验失败，已禁止恢复。</span> : null}
            </div>
            <RestoreRevisionForm
              expectedUpdatedAt={expectedUpdatedAt}
              postId={postId}
              restorable={revision.restorable}
              revisionId={revision.id}
            />
          </article>
        ))}
        {revisions.length === 0 ? <p className="empty-state">下一次保存后会在这里保留当前版本。</p> : null}
      </div>
    </section>
  );
}

function RestoreRevisionForm({
  expectedUpdatedAt,
  postId,
  restorable,
  revisionId,
}: {
  readonly expectedUpdatedAt: string;
  readonly postId: string;
  readonly restorable: boolean;
  readonly revisionId: string;
}) {
  const [state, action] = useActionState(restorePostRevisionWithState, INITIAL_MUTATION_STATE);

  return (
    <div>
      <form action={action} onSubmit={confirmRevisionRestore}>
        <input name="id" type="hidden" value={postId} />
        <input name="revisionId" type="hidden" value={revisionId} />
        <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />
        <SubmitButton
          className="button button--ghost"
          disabled={!restorable}
          pendingChildren="恢复中..."
        >
          <RotateCcw size={15} />
          恢复
        </SubmitButton>
      </form>
      <p className="form-error" hidden={state.status !== "error"} role="alert">
        {state.status === "error" ? state.message : ""}
      </p>
    </div>
  );
}

function PreviewLinkResult({ state }: { readonly state: PostPreviewLinkState }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    return <p className="post-workflow__message" role="alert">{state.message}</p>;
  }

  const copyLink = async () => {
    try {
      const absoluteHref = new URL(state.href, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteHref);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="post-workflow__preview">
      <div role="status">
        <span>
          本次生成的链接将在 <time dateTime={state.expiresAt}>{formatDateTime(state.expiresAt)}</time> 失效；重新生成会立即撤销旧链接。
        </span>
        <code>{state.href}</code>
        <span aria-live="polite" className="post-workflow__copy-status">
          {copyState === "copied" ? "链接已复制。" : null}
          {copyState === "error" ? "复制失败，请打开预览后从地址栏复制。" : null}
        </span>
      </div>
      <div className="post-workflow__preview-actions">
        <button
          aria-label={copyState === "copied" ? "预览链接已复制" : "复制预览链接"}
          className="button button--ghost"
          onClick={copyLink}
          type="button"
        >
          {copyState === "copied" ? <Check size={15} /> : <Copy size={15} />}
          {copyState === "copied" ? "已复制" : "复制"}
        </button>
        <a className="button button--ghost" href={state.href} rel="noreferrer" target="_blank">
          <ExternalLink size={15} />
          打开预览
        </a>
      </div>
    </div>
  );
}

function confirmRevisionRestore(event: FormEvent<HTMLFormElement>) {
  const confirmed = window.confirm("确定恢复这个历史版本吗？当前版本会先保存，因此可以再次恢复。");

  if (!confirmed) {
    event.preventDefault();
  }
}

function formatRevisionReason(reason: RevisionSummary["reason"]) {
  if (reason === "PUBLISH") return "发布前版本";
  if (reason === "RESTORE") return "恢复前版本";
  return "保存前版本";
}

function formatRevisionStatus(revision: RevisionSummary) {
  if (!revision.restorable || !revision.status) return "不可恢复";
  return revision.status === "PUBLISHED" ? "已发布" : "草稿";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
