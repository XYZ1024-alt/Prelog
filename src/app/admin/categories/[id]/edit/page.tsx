import { notFound } from "next/navigation";

import { AdminNav } from "@/app/admin/admin-nav";
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
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <span className="eyebrow">Edit Category</span>
        <h1>编辑分类</h1>
        <CategoryEditor action={updateCategory} category={category} />
      </section>
    </main>
  );
}
