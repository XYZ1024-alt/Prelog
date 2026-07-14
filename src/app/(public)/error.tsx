"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PageShell } from "@/components/page-shell";

export default function PublicError({ error, reset }: { readonly error: Error; readonly reset: () => void }) {
  useEffect(() => {
    console.error("Public page rendering failed.", error);
  }, [error]);

  return (
    <PageShell className="route-state">
      <span className="eyebrow">页面错误</span>
      <h1>这个页面暂时无法加载</h1>
      <p>请重试；如果问题持续存在，请查看服务端日志中的原始错误。</p>
      <div className="route-state__actions">
        <button className="button button--primary" onClick={reset} type="button">重新加载</button>
        <Link className="button button--ghost" href="/">返回首页</Link>
      </div>
    </PageShell>
  );
}
