"use client";

import { useEffect } from "react";

export default function AdminLoginError({ error, reset }: { readonly error: Error; readonly reset: () => void }) {
  useEffect(() => {
    console.error("Admin login rendering failed.", error);
  }, [error]);

  return (
    <main className="admin-login">
      <div className="admin-login__toolbar"><span>Prelog 管理台</span></div>
      <section className="admin-login__panel admin-state">
        <span className="eyebrow">登录页面错误</span>
        <h1>无法加载登录页面</h1>
        <p>原始错误已写入控制台和服务端日志，请检查后重试。</p>
        <button className="button button--primary" onClick={reset} type="button">重新加载</button>
      </section>
    </main>
  );
}
