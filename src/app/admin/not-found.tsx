import Link from "next/link";

import { AdminShell } from "@/app/admin/admin-shell";
import { toAdminPath } from "@/lib/admin-path";

export default function AdminNotFound() {
  return (
    <AdminShell>
      <section className="admin-state">
        <span className="eyebrow">404</span>
        <h1>没有找到这个管理页面</h1>
        <p>这条记录可能已被删除，或者地址已经失效。</p>
        <Link className="button button--primary" href={toAdminPath()}>返回后台概览</Link>
      </section>
    </AdminShell>
  );
}
