"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { toAdminPath } from "@/lib/admin-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("邮箱或密码不正确。");
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? toAdminPath());
    router.refresh();
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        邮箱
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        密码
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit">
        登录
      </button>
    </form>
  );
}
