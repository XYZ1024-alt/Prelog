import { Suspense } from "react";

import { LoginForm } from "@/app/admin/login/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <span className="eyebrow">Admin</span>
        <h1>登录后台</h1>
        <p className="admin-login__intro">这是个人后台入口，仅保留一个管理员账号，不提供注册和多用户管理。</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
