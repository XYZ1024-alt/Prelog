import { PenLine } from "lucide-react";
import { Suspense } from "react";

import { LoginForm } from "@/app/admin/login/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="admin-login">
      <div className="admin-login__toolbar">
        <span>Prelog 管理台</span>
        <ThemeToggle />
      </div>
      <section className="admin-login__panel">
        <span className="admin-login__mark"><PenLine size={22} /></span>
        <span className="eyebrow">管理后台</span>
        <h1>登录后台</h1>
        <p className="admin-login__intro">使用管理员邮箱和密码继续。</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
