import Link from "next/link";

import { PageShell } from "@/components/page-shell";

export default function PublicNotFound() {
  return (
    <PageShell className="route-state">
      <span className="eyebrow">404</span>
      <h1>没有找到这个页面</h1>
      <p>地址可能已经失效，也可能从未存在。</p>
      <div className="route-state__actions">
        <Link className="button button--primary" href="/">返回首页</Link>
        <Link className="button button--ghost" href="/archive">浏览归档</Link>
      </div>
    </PageShell>
  );
}
