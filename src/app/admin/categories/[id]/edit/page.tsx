import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { CategoryEditor } from "@/app/admin/categories/category-editor";
import { updateCategory } from "@/app/admin/categories/actions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function EditCategoryPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    notFound();
  }

  return (
    <AdminShell>
      <AdminPageHeader label="内容组织" title="编辑分类" />
      <CategoryEditor action={updateCategory} category={category} />
    </AdminShell>
  );
}
