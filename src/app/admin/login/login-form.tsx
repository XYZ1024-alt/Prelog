"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { toAdminPath } from "@/lib/admin-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("邮箱或密码不正确。");
      setIsSubmitting(false);
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? toAdminPath());
    router.refresh();
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        邮箱
        <input autoComplete="email" disabled={isSubmitting} name="email" required type="email" />
      </label>
      <label>
        密码
        <input autoComplete="current-password" disabled={isSubmitting} name="password" required type="password" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button aria-busy={isSubmitting} className="button button--primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "登录中..." : "登录"}
      </button>
    </form>
  );
}
