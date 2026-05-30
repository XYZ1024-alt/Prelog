"use client";

import { signOut } from "next-auth/react";
import type { ComponentType } from "react";

type SignOutButtonProps = {
  readonly icon: ComponentType<{ size?: number }>;
};

export function SignOutButton({ icon: Icon }: SignOutButtonProps) {
  return (
    <button
      className="admin-nav__signout"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      type="button"
    >
      <Icon size={16} />
      退出登录
    </button>
  );
}
