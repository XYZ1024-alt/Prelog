"use client";

import Link from "next/link";
import { FileText, FolderTree, LayoutDashboard, LogOut, MessageSquare, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/app/admin/sign-out-button";

const ADMIN_LINKS = [
  { href: "/admin", label: "后台概览", icon: LayoutDashboard },
  { href: "/admin/posts", label: "文章管理", icon: FileText },
  { href: "/admin/categories", label: "分类管理", icon: FolderTree },
  { href: "/admin/comments", label: "评论管理", icon: MessageSquare },
  { href: "/admin/settings", label: "管理员设置", icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="后台导航">
      <div className="admin-nav__group">
        {ADMIN_LINKS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link aria-current={active ? "page" : undefined} data-active={active} href={item.href} key={item.href}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="admin-nav__footer">
        <SignOutButton icon={LogOut} />
      </div>
    </nav>
  );
}
