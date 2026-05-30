import { notFound } from "next/navigation";

import { AdminNav } from "@/app/admin/admin-nav";
import { updatePost } from "@/app/admin/posts/actions";
import { PostEditor } from "@/app/admin/posts/post-editor";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPostPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const [post, categories] = await Promise.all([
    prisma.post.findUnique({ where: { id }, include: { tags: { include: { tag: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <span className="eyebrow">Edit Post</span>
        <h1>编辑文章</h1>
        <PostEditor action={updatePost} categories={categories} post={post} />
      </section>
    </main>
  );
}
