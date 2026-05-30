import { Suspense } from "react";

import { LoginForm } from "@/app/admin/login/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <span className="eyebrow">Admin</span>
        <h1>登录后台</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
