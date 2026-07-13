"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import type { ComponentType } from "react";

import { ButtonStateContent } from "@/components/button-state-content";
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
      <ButtonStateContent pending={isSigningOut} pendingChildren="退出中...">
        <Icon size={16} />
        退出登录
      </ButtonStateContent>
    </button>
  );
}
