import type { ReactNode } from "react";

import { AdminNav } from "@/app/admin/admin-nav";

export function AdminShell({ children }: { readonly children: ReactNode }) {
  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">{children}</section>
    </main>
  );
}
