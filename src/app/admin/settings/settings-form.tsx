type SettingsFormProps = {
  readonly action: (formData: FormData) => Promise<void>;
  readonly defaults: {
    readonly email: string;
    readonly name: string | null;
  };
};

export function SettingsForm({ action, defaults }: SettingsFormProps) {
  return (
    <form action={action} className="post-editor">
      <div className="form-grid">
        <label>
          管理员名称
          <input defaultValue={defaults.name ?? ""} name="name" placeholder="Prelog Admin" />
        </label>
        <label>
          登录邮箱
          <input defaultValue={defaults.email} name="email" required type="email" />
        </label>
      </div>
      <label>
        当前密码
        <input autoComplete="current-password" name="currentPassword" required type="password" />
      </label>
      <div className="form-grid">
        <label>
          新密码
          <input autoComplete="new-password" name="newPassword" placeholder="留空表示不修改密码" type="password" />
        </label>
        <label>
          确认新密码
          <input autoComplete="new-password" name="confirmPassword" placeholder="再次输入新密码" type="password" />
        </label>
      </div>
      <button className="button button--primary" type="submit">
        保存管理员设置
      </button>
    </form>
  );
}
