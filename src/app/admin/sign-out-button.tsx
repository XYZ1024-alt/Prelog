"use client";

import { signOut } from "next-auth/react";
import type { ComponentType } from "react";

import { toAdminPath } from "@/lib/admin-path";

type SignOutButtonProps = {
  readonly icon: ComponentType<{ size?: number }>;
};

export function SignOutButton({ icon: Icon }: SignOutButtonProps) {
  return (
    <button
      className="admin-nav__signout"
      onClick={() => signOut({ callbackUrl: toAdminPath("/login") })}
      type="button"
    >
      <Icon size={16} />
      退出登录
    </button>
  );
}
