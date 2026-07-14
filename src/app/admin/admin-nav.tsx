"use client";

import Link from "next/link";
import {
  ExternalLink,
  FileText,
  FolderTree,
  Hash,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  PenLine,
  Settings,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SignOutButton } from "@/app/admin/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PUBLIC_ADMIN_PATH, toAdminPath } from "@/lib/admin-path";
import { isAdminNavigationItemActive } from "@/lib/navigation-state";

const ADMIN_LINKS = [
  { href: toAdminPath(), label: "后台概览", icon: LayoutDashboard },
  { href: toAdminPath("/posts"), label: "文章管理", icon: FileText },
  { href: toAdminPath("/categories"), label: "分类管理", icon: FolderTree },
  { href: toAdminPath("/tags"), label: "标签概览", icon: Hash },
  { href: toAdminPath("/friends"), label: "友链管理", icon: Link2 },
  { href: toAdminPath("/comments"), label: "评论管理", icon: MessageSquare },
  { href: toAdminPath("/settings"), label: "管理员设置", icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const open = openedAtPath === pathname;

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenedAtPath(null);
      toggleRef.current?.focus();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <nav className="admin-nav" aria-label="后台导航">
      <div className="admin-nav__brand-row">
        <Link className="admin-nav__brand" href={toAdminPath()}>
          <span className="admin-nav__brand-mark"><PenLine size={17} /></span>
          <span>
            <strong>Prelog</strong>
            <small>管理台</small>
          </span>
        </Link>
        <div className="admin-nav__controls">
          <ThemeToggle />
          <button
            aria-controls="admin-navigation-menu"
            aria-expanded={open}
            aria-label={open ? "关闭后台导航" : "打开后台导航"}
            className="icon-button admin-nav__toggle"
            onClick={() => setOpenedAtPath(open ? null : pathname)}
            ref={toggleRef}
            type="button"
          >
            <Menu aria-hidden="true" className="admin-nav__toggle-icon admin-nav__toggle-icon--menu" size={18} />
            <X aria-hidden="true" className="admin-nav__toggle-icon admin-nav__toggle-icon--close" size={18} />
          </button>
        </div>
      </div>
      <div className="admin-nav__menu" data-open={open} id="admin-navigation-menu">
        <div className="admin-nav__group">
          {ADMIN_LINKS.map((item) => {
            const Icon = item.icon;
            const active = isAdminNavigationItemActive(pathname, item.href, PUBLIC_ADMIN_PATH);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                data-active={active}
                href={item.href}
                key={item.href}
                onClick={() => setOpenedAtPath(null)}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="admin-nav__footer">
          <Link className="admin-nav__utility" href="/" onClick={() => setOpenedAtPath(null)}>
            <ExternalLink size={16} />
            查看站点
          </Link>
          <SignOutButton icon={LogOut} />
        </div>
      </div>
    </nav>
  );
}
