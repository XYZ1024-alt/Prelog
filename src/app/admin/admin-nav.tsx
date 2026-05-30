"use client";

import Link from "next/link";
import { FileText, FolderTree, Hash, LayoutDashboard, LogOut, MessageSquare, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/app/admin/sign-out-button";
import { PUBLIC_ADMIN_PATH, toAdminPath } from "@/lib/admin-path";

const ADMIN_LINKS = [
  { href: toAdminPath(), label: "后台概览", icon: LayoutDashboard },
  { href: toAdminPath("/posts"), label: "文章管理", icon: FileText },
  { href: toAdminPath("/categories"), label: "分类管理", icon: FolderTree },
  { href: toAdminPath("/tags"), label: "标签概览", icon: Hash },
  { href: toAdminPath("/comments"), label: "评论管理", icon: MessageSquare },
  { href: toAdminPath("/settings"), label: "管理员设置", icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="后台导航">
      <div className="admin-nav__group">
        {ADMIN_LINKS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || pathname === item.href.replace(PUBLIC_ADMIN_PATH, "/admin") || pathname.startsWith(`${item.href.replace(PUBLIC_ADMIN_PATH, "/admin")}/`);

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
