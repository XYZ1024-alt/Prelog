import Link from "next/link";
import { PenLine, Search } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { getSiteSettings } from "@/lib/site-settings";

const NAV_ITEMS = [
  { href: "/", label: "文章" },
  { href: "/about", label: "关于" },
] as const;

export async function SiteHeader() {
  const settings = await getSiteSettings();

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand__mark">
          <PenLine size={18} />
        </span>
        <span>{settings.siteName}</span>
      </Link>
      <nav className="site-nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="site-actions">
        <Link className="icon-button" href="/search" aria-label="搜索文章">
          <Search size={17} />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const settings = await getSiteSettings();

  return (
    <footer className="site-footer">
      <div>
        <p>{settings.footerPrimary}</p>
        <p>{settings.footerSecondary}</p>
      </div>
    </footer>
  );
}
