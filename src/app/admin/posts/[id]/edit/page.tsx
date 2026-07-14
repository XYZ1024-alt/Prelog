import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { updatePostWithState } from "@/app/admin/posts/actions";
import { PostEditor } from "@/app/admin/posts/post-editor";
import { PostWorkflowPanel } from "@/app/admin/posts/post-workflow-panel";
import { postRevisionSnapshotSchema } from "@/lib/post-revisions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getConfiguredManualCoverHosts } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const REVISION_LIMIT = 12;

export default async function EditPostPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const [post, categories, revisions] = await Promise.all([
    prisma.post.findUnique({ where: { id }, include: { tags: { include: { tag: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.postRevision.findMany({
      where: { postId: id },
      orderBy: { createdAt: "desc" },
      take: REVISION_LIMIT,
    }),
  ]);

  if (!post) {
    notFound();
  }

  const revisionSummaries = revisions.map((revision) => {
    const snapshot = postRevisionSnapshotSchema.safeParse(revision.snapshot);

    if (!snapshot.success) {
      return {
        createdAt: revision.createdAt.toISOString(),
        id: revision.id,
        reason: revision.reason,
        restorable: false,
        status: null,
        title: "损坏或不受支持的版本",
      } as const;
    }

    return {
      createdAt: revision.createdAt.toISOString(),
      id: revision.id,
      reason: revision.reason,
      restorable: true,
      status: snapshot.data.status,
      title: snapshot.data.title,
    };
  });

  return (
    <AdminShell>
      <AdminPageHeader label="文章编辑" title="编辑文章" />
      <PostEditor
        action={updatePostWithState}
        categories={categories}
        manualCoverHosts={getConfiguredManualCoverHosts()}
        post={post}
      />
      <PostWorkflowPanel
        expectedUpdatedAt={post.updatedAt.toISOString()}
        postId={post.id}
        revisions={revisionSummaries}
      />
    </AdminShell>
  );
}
