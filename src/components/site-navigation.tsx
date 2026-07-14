"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { isNavigationItemActive } from "@/lib/navigation-state";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/categories", label: "分类" },
  { href: "/tags", label: "标签" },
  { href: "/archive", label: "归档" },
] as const;
const FRIENDS_NAV_ITEM = { href: "/friends", label: "友链" } as const;
const ABOUT_NAV_ITEM = { href: "/about", label: "关于" } as const;

export function SiteNavigation({ friendsEnabled }: { readonly friendsEnabled: boolean }) {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const open = openedAtPath === pathname;
  const items = friendsEnabled
    ? [...NAV_ITEMS, FRIENDS_NAV_ITEM, ABOUT_NAV_ITEM]
    : [...NAV_ITEMS, ABOUT_NAV_ITEM];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpenedAtPath(null);
      toggleRef.current?.focus();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="site-navigation">
      <button
        aria-controls="site-navigation-menu"
        aria-expanded={open}
        aria-label={open ? "关闭导航" : "打开导航"}
        className="icon-button site-nav-toggle"
        onClick={() => setOpenedAtPath(open ? null : pathname)}
        ref={toggleRef}
        type="button"
      >
        <Menu aria-hidden="true" className="site-nav-toggle__icon site-nav-toggle__icon--menu" size={19} />
        <X aria-hidden="true" className="site-nav-toggle__icon site-nav-toggle__icon--close" size={19} />
      </button>
      <nav aria-label="主导航" className="site-nav" data-open={open} id="site-navigation-menu">
        {items.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              data-active={active}
              href={item.href}
              key={item.href}
              onClick={() => setOpenedAtPath(null)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
