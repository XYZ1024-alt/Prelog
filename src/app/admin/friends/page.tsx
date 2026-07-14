import { Link2, Pencil, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { updateFriendSettings } from "@/app/admin/friends/actions";
import { FriendRowActions } from "@/app/admin/friends/friend-row-actions";
import { FriendSettingsForm } from "@/app/admin/friends/friend-settings-form";
import { toAdminPath } from "@/lib/admin-path";
import { getAdminFriendLinks } from "@/lib/friend-links";
import { getFriendLinkHostname } from "@/lib/friend-link-utils";
import { requireAdmin } from "@/lib/session";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

type AdminFriendsPageProps = {
  readonly searchParams: Promise<{ created?: string; updated?: string }>;
};

export default async function AdminFriendsPage({ searchParams }: AdminFriendsPageProps) {
  await requireAdmin();
  const [params, friendLinks, settings] = await Promise.all([
    searchParams,
    getAdminFriendLinks(),
    getSiteSettings(),
  ]);

  return (
    <AdminShell>
      <AdminPageHeader
        actions={(
          <Link className="button button--primary" href={toAdminPath("/friends/new")}>
            <Plus aria-hidden="true" size={16} />
            新建友链
          </Link>
        )}
        label="站点网络"
        title="友链管理"
      />
      {params.created === "1" ? <p className="form-success">友链已创建。</p> : null}
      {params.updated === "1" ? <p className="form-success">友链已更新。</p> : null}
      <section className="admin-section">
        <div className="admin-card__head">
          <h2>友链列表</h2>
          <span>{friendLinks.length} 条记录</span>
        </div>
        <div className="admin-table">
          {friendLinks.map((friendLink) => (
            <article className="admin-row admin-row--friend" key={friendLink.id}>
              <div>
                <div className="admin-friend-title">
                  <strong>{friendLink.name}</strong>
                  <span data-visible={friendLink.isVisible}>{friendLink.isVisible ? "公开" : "隐藏"}</span>
                </div>
                <span>{getFriendLinkHostname(friendLink.url)} · 排序 {friendLink.sortOrder}</span>
                <p className="admin-row__note">{friendLink.description}</p>
              </div>
              <div className="admin-row__actions-wrap">
                <div className="admin-row__actions">
                  <Link className="button button--ghost" href={toAdminPath(`/friends/${friendLink.id}/edit`)}>
                    <Pencil aria-hidden="true" size={15} />
                    编辑
                  </Link>
                </div>
                <FriendRowActions id={friendLink.id} isVisible={friendLink.isVisible} />
              </div>
            </article>
          ))}
          {friendLinks.length === 0 ? (
            <div className="admin-empty-state">
              <Link2 aria-hidden="true" size={16} />
              <p>还没有友链，先新建一条记录。</p>
            </div>
          ) : null}
        </div>
      </section>
      <section className="admin-section admin-section--settings">
        <div className="admin-card__head">
          <h2>公开页面设置</h2>
          <span>导航与交换说明</span>
        </div>
        <div className="admin-settings-note">
          <ShieldCheck aria-hidden="true" size={16} />
          <p>开关会同时控制导航入口、公开页面和 sitemap，不会删除已经保存的友链。</p>
        </div>
        <FriendSettingsForm
          action={updateFriendSettings}
          defaults={{
            friendsContactLabel: settings.friendsContactLabel,
            friendsContactUrl: settings.friendsContactUrl,
            friendsEnabled: settings.friendsEnabled,
            friendsIntro: settings.friendsIntro,
            friendsRequirements: settings.friendsRequirements,
          }}
        />
      </section>
    </AdminShell>
  );
}
