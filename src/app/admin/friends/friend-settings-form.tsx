"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import {
  INITIAL_FRIEND_SETTINGS_MUTATION_STATE,
  type FriendSettingsFormValues,
  type FriendSettingsMutationState,
} from "@/lib/friend-link-workflow";

type FriendSettingsFormProps = {
  readonly action: (
    state: FriendSettingsMutationState,
    formData: FormData,
  ) => Promise<FriendSettingsMutationState>;
  readonly defaults: FriendSettingsFormValues;
};

export function FriendSettingsForm({ action, defaults }: FriendSettingsFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_FRIEND_SETTINGS_MUTATION_STATE);
  const values = state.status === "idle" ? defaults : state.values;
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="post-editor friend-settings-form" key={state.revision}>
      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
      {state.status === "success" ? <p className="form-success" role="status">友链设置已保存。</p> : null}
      <label className="admin-switch-field">
        <input defaultChecked={values.friendsEnabled} name="friendsEnabled" role="switch" type="checkbox" />
        <span aria-hidden="true" className="admin-switch-field__control" />
        <span>
          <strong>启用友链页面与导航</strong>
          <small>关闭后导航入口隐藏，/friends 返回 404，并从 sitemap 移除；友链数据不会删除。</small>
        </span>
      </label>
      <SettingsField error={errors.friendsIntro?.[0]} label="友链页简介" name="friendsIntro">
        <textarea aria-describedby={errors.friendsIntro ? "friendsIntro-error" : undefined} aria-invalid={Boolean(errors.friendsIntro)} defaultValue={values.friendsIntro} maxLength={2000} name="friendsIntro" required rows={3} />
      </SettingsField>
      <SettingsField error={errors.friendsRequirements?.[0]} label="交换要求（每行一条）" name="friendsRequirements">
        <textarea aria-describedby={errors.friendsRequirements ? "friendsRequirements-error" : undefined} aria-invalid={Boolean(errors.friendsRequirements)} defaultValue={values.friendsRequirements} maxLength={2000} name="friendsRequirements" rows={5} />
      </SettingsField>
      <div className="form-grid">
        <SettingsField error={errors.friendsContactLabel?.[0]} label="联系按钮文案" name="friendsContactLabel">
          <input aria-describedby={errors.friendsContactLabel ? "friendsContactLabel-error" : undefined} aria-invalid={Boolean(errors.friendsContactLabel)} defaultValue={values.friendsContactLabel} maxLength={120} name="friendsContactLabel" required />
        </SettingsField>
        <SettingsField error={errors.friendsContactUrl?.[0]} label="联系地址" name="friendsContactUrl">
          <input aria-describedby={errors.friendsContactUrl ? "friendsContactUrl-error" : undefined} aria-invalid={Boolean(errors.friendsContactUrl)} defaultValue={values.friendsContactUrl} maxLength={2048} name="friendsContactUrl" required />
        </SettingsField>
      </div>
      <SubmitButton className="button button--primary" pendingChildren="保存中...">
        <Save aria-hidden="true" size={16} />
        保存友链设置
      </SubmitButton>
    </form>
  );
}

function SettingsField({
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
