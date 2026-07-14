"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { readonly error: Error; readonly reset: () => void }) {
  useEffect(() => {
    console.error("Prelog root rendering failed.", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main className="global-error route-state">
          <span className="eyebrow">系统错误</span>
          <h1>Prelog 无法完成页面渲染</h1>
          <p>请检查服务端日志中的原始错误，再尝试重新加载。</p>
          <button className="button button--primary" onClick={reset} type="button">重新加载</button>
        </main>
      </body>
    </html>
  );
}
