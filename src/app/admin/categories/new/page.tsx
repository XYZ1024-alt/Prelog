import { AdminNav } from "@/app/admin/admin-nav";
import { CategoryEditor } from "@/app/admin/categories/category-editor";
import { createCategory } from "@/app/admin/categories/actions";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireAdmin();

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <span className="eyebrow">New Category</span>
        <h1>新建分类</h1>
        <CategoryEditor action={createCategory} />
      </section>
    </main>
  );
}
