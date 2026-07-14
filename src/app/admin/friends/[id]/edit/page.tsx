import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { updateFriendLink } from "@/app/admin/friends/actions";
import { FriendLinkEditor } from "@/app/admin/friends/friend-link-editor";
import { toAdminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type EditFriendLinkPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function EditFriendLinkPage({ params }: EditFriendLinkPageProps) {
  await requireAdmin();
  const parsed = idSchema.safeParse(await params);

  if (!parsed.success) {
    notFound();
  }

  const friendLink = await prisma.friendLink.findUnique({ where: { id: parsed.data.id } });

  if (!friendLink) {
    notFound();
  }

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
        title={`编辑 ${friendLink.name}`}
      />
      <FriendLinkEditor action={updateFriendLink} friendLink={friendLink} />
    </AdminShell>
  );
}
