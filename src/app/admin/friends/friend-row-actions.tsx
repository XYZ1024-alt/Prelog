"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useActionState, type FormEvent } from "react";

import {
  deleteFriendLink,
  toggleFriendLinkVisibility,
} from "@/app/admin/friends/actions";
import { SubmitButton } from "@/components/submit-button";
import { INITIAL_FRIEND_LINK_ROW_ACTION_STATE } from "@/lib/friend-link-workflow";

export function FriendRowActions({ id, isVisible }: { readonly id: string; readonly isVisible: boolean }) {
  const [toggleState, toggleAction] = useActionState(
    toggleFriendLinkVisibility,
    INITIAL_FRIEND_LINK_ROW_ACTION_STATE,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteFriendLink,
    INITIAL_FRIEND_LINK_ROW_ACTION_STATE,
  );
  const error = toggleState.status === "error"
    ? toggleState.message
    : deleteState.status === "error" ? deleteState.message : null;

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("确定删除这条友链吗？此操作无法撤销。")) {
      event.preventDefault();
    }
  }

  return (
    <div className="friend-row-actions">
      <div className="admin-row__actions">
        <form action={toggleAction}>
          <input name="id" type="hidden" value={id} />
          <SubmitButton className="button button--ghost" pendingChildren="更新中...">
            {isVisible ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
            {isVisible ? "隐藏" : "公开"}
          </SubmitButton>
        </form>
        <form action={deleteAction} onSubmit={confirmDelete}>
          <input name="id" type="hidden" value={id} />
          <SubmitButton className="button button--danger" pendingChildren="删除中...">
            <Trash2 aria-hidden="true" size={15} />
            删除
          </SubmitButton>
        </form>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
