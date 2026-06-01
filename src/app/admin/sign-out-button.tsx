"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import type { ComponentType } from "react";

import { toAdminPath } from "@/lib/admin-path";

type SignOutButtonProps = {
  readonly icon: ComponentType<{ size?: number }>;
};

export function SignOutButton({ icon: Icon }: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <button
      aria-busy={isSigningOut}
      className="admin-nav__signout"
      disabled={isSigningOut}
      onClick={() => {
        setIsSigningOut(true);
        void signOut({ callbackUrl: toAdminPath("/login") });
      }}
      type="button"
    >
      <Icon size={16} />
      {isSigningOut ? "退出中..." : "退出登录"}
    </button>
  );
}
