import { ShieldCheck } from "lucide-react";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { updateAdminProfile, updateSiteSettings } from "@/app/admin/settings/actions";
import { SettingsForm } from "@/app/admin/settings/settings-form";
import { SiteSettingsForm } from "@/app/admin/settings/site-settings-form";
import { getSiteSettings } from "@/lib/site-settings";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; updated?: string }>;
};

export default async function AdminSettingsPage({ searchParams }: SettingsPageProps) {
  const [{ error, updated }, { user }, siteSettings] = await Promise.all([searchParams, requireAdmin(), getSiteSettings()]);

  return (
    <AdminShell>
      <AdminPageHeader label="系统设置" title="管理员设置" />

      <section className="admin-section admin-section--settings">
          <div className="admin-card__head">
            <h2>管理员资料</h2>
            <span>登录信息</span>
          </div>
          <div className="admin-settings-note">
            <ShieldCheck size={16} />
            <p>这里可以直接修改登录邮箱、显示名称和密码。</p>
          </div>
          {updated === "1" ? <p className="form-success">管理员设置已保存。</p> : null}
          {error === "password" ? <p className="form-error">当前密码不正确。</p> : null}
          {error === "email" ? <p className="form-error">这个邮箱已经被其他账号使用。</p> : null}
          <SettingsForm
            action={updateAdminProfile}
            defaults={{ email: user.email, name: user.name }}
          />
      </section>
      <section className="admin-section admin-section--settings">
          <div className="admin-card__head">
            <h2>站点内容设置</h2>
            <span>单站点单配置</span>
          </div>
          <div className="admin-settings-note">
            <ShieldCheck size={16} />
            <p>这里修改后，会直接影响首页、关于页、页脚和全站元信息。</p>
          </div>
          {updated === "site" ? <p className="form-success">站点设置已保存。</p> : null}
          <SiteSettingsForm action={updateSiteSettings} defaults={siteSettings} />
      </section>
    </AdminShell>
  );
}
