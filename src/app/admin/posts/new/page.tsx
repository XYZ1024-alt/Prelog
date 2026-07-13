import { AdminNav } from "@/app/admin/admin-nav";
import { createPostWithState } from "@/app/admin/posts/actions";
import { PostEditor } from "@/app/admin/posts/post-editor";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getConfiguredManualCoverHosts } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <span className="eyebrow">New Post</span>
        <h1>新建文章</h1>
        <PostEditor
          action={createPostWithState}
          categories={categories}
          manualCoverHosts={getConfiguredManualCoverHosts()}
        />
      </section>
    </main>
  );
}
