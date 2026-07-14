import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { createFriendLink } from "@/app/admin/friends/actions";
import { FriendLinkEditor } from "@/app/admin/friends/friend-link-editor";
import { toAdminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewFriendLinkPage() {
  await requireAdmin();

  return (
    <AdminShell>
      <AdminPageHeader
        actions={(
          <Link className="button button--ghost" href={toAdminPath("/friends")}>
            <ArrowLeft aria-hidden="true" size={16} />
            返回友链
          </Link>
        )}
        label="站点网络"
        title="新建友链"
      />
      <FriendLinkEditor action={createFriendLink} />
    </AdminShell>
  );
}
