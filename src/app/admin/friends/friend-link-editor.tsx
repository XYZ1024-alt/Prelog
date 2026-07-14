"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import {
  INITIAL_FRIEND_LINK_MUTATION_STATE,
  type FriendLinkFormValues,
  type FriendLinkMutationState,
} from "@/lib/friend-link-workflow";

type FriendLinkEditorProps = {
  readonly action: (
    state: FriendLinkMutationState,
    formData: FormData,
  ) => Promise<FriendLinkMutationState>;
  readonly friendLink?: FriendLinkEditorDefaults;
};

type FriendLinkEditorDefaults = {
  readonly description: string;
  readonly id: string;
  readonly isVisible: boolean;
  readonly logoUrl: string | null;
  readonly name: string;
  readonly sortOrder: number;
  readonly url: string;
};

export function FriendLinkEditor({ action, friendLink }: FriendLinkEditorProps) {
  const [state, formAction] = useActionState(action, INITIAL_FRIEND_LINK_MUTATION_STATE);
  const values = getFormValues(state, friendLink);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="post-editor friend-link-editor" key={state.revision}>
      {friendLink ? <input name="id" type="hidden" value={friendLink.id} /> : null}
      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
      <div className="form-grid">
        <FormField error={errors.name?.[0]} label="站点名称" name="name">
          <input aria-describedby={errors.name ? "name-error" : undefined} aria-invalid={Boolean(errors.name)} defaultValue={values.name} maxLength={120} name="name" required />
        </FormField>
        <FormField error={errors.sortOrder?.[0]} label="排序值" name="sortOrder">
          <input aria-describedby={errors.sortOrder ? "sortOrder-error" : undefined} aria-invalid={Boolean(errors.sortOrder)} defaultValue={values.sortOrder} max={9999} min={-9999} name="sortOrder" required type="number" />
        </FormField>
      </div>
      <FormField error={errors.url?.[0]} label="网站地址" name="url">
        <input aria-describedby={errors.url ? "url-error" : undefined} aria-invalid={Boolean(errors.url)} defaultValue={values.url} maxLength={2048} name="url" placeholder="https://example.com/" required type="url" />
      </FormField>
      <FormField error={errors.logoUrl?.[0]} label="Logo 地址（可选）" name="logoUrl">
        <input aria-describedby={errors.logoUrl ? "logoUrl-error" : undefined} aria-invalid={Boolean(errors.logoUrl)} defaultValue={values.logoUrl} maxLength={2048} name="logoUrl" placeholder="https://example.com/logo.png" type="url" />
      </FormField>
      <FormField error={errors.description?.[0]} label="站点描述" name="description">
        <textarea aria-describedby={errors.description ? "description-error" : undefined} aria-invalid={Boolean(errors.description)} defaultValue={values.description} maxLength={300} name="description" required rows={4} />
      </FormField>
      <label className="admin-check-field">
        <input defaultChecked={values.isVisible} name="isVisible" type="checkbox" />
        <span>
          <strong>公开显示</strong>
          <small>关闭后记录仍保留，但不会出现在公开友链页。</small>
        </span>
      </label>
      <SubmitButton className="button button--primary" pendingChildren="保存中...">
        <Save aria-hidden="true" size={16} />
        保存友链
      </SubmitButton>
    </form>
  );
}

function FormField({
  children,
  error,
  label,
  name,
}: {
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly label: string;
  readonly name: string;
}) {
  return (
    <label>
      {label}
      {children}
      {error ? <span className="form-field-error" id={`${name}-error`}>{error}</span> : null}
    </label>
  );
}

function getFormValues(
  state: FriendLinkMutationState,
  friendLink?: FriendLinkEditorDefaults,
): FriendLinkFormValues {
  if (state.status === "error") {
    return state.values;
  }

  return {
    description: friendLink?.description ?? "",
    isVisible: friendLink?.isVisible ?? true,
    logoUrl: friendLink?.logoUrl ?? "",
    name: friendLink?.name ?? "",
    sortOrder: String(friendLink?.sortOrder ?? 0),
    url: friendLink?.url ?? "",
  };
}
