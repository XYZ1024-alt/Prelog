import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { createPostWithState } from "@/app/admin/posts/actions";
import { PostEditor } from "@/app/admin/posts/post-editor";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <AdminShell>
      <AdminPageHeader label="文章编辑" title="新建文章" />
      <PostEditor
        action={createPostWithState}
        categories={categories}
      />
    </AdminShell>
  );
}
