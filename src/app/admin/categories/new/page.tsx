import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminShell } from "@/app/admin/admin-shell";
import { CategoryEditor } from "@/app/admin/categories/category-editor";
import { createCategory } from "@/app/admin/categories/actions";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireAdmin();

  return (
    <AdminShell>
      <AdminPageHeader label="内容组织" title="新建分类" />
      <CategoryEditor action={createCategory} />
    </AdminShell>
  );
}
