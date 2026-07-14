import { AdminShell } from "@/app/admin/admin-shell";

export default function AdminLoading() {
  return (
    <AdminShell>
      <div aria-busy="true" aria-label="正在加载管理页面" className="admin-loading">
        <span className="sr-only">正在加载管理页面</span>
        <span className="admin-loading__line admin-loading__line--title" />
        <span className="admin-loading__line" />
        <span className="admin-loading__grid" />
      </div>
    </AdminShell>
  );
}
