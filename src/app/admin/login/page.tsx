import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/admin/login/login-form";
import { authOptions } from "@/lib/auth";
import { ADMIN_USER_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id === ADMIN_USER_ID) {
    redirect("/admin");
  }

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
