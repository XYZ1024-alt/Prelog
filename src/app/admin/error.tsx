"use client";

import { useEffect } from "react";

import { AdminShell } from "@/app/admin/admin-shell";

export default function AdminError({ error, reset }: { readonly error: Error; readonly reset: () => void }) {
  useEffect(() => {
    console.error("Admin page rendering failed.", error);
  }, [error]);

  return (
    <AdminShell>
      <section className="admin-state">
        <span className="eyebrow">管理页面错误</span>
        <h1>无法加载当前管理页面</h1>
        <p>原始错误已写入控制台和服务端日志，请检查后重试。</p>
        <button className="button button--primary" onClick={reset} type="button">重新加载</button>
      </section>
    </AdminShell>
  );
}
