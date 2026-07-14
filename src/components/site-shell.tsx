import Link from "next/link";
import { Archive, PenLine, Rss, Search } from "lucide-react";

import { SiteNavigation } from "@/components/site-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSiteSettings } from "@/lib/site-settings";

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
      <SiteNavigation friendsEnabled={settings.friendsEnabled} />
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
      <nav aria-label="页脚导航" className="site-footer__nav">
        <Link href="/archive">
          <Archive aria-hidden="true" size={15} />
          文章归档
        </Link>
        <a href="/rss.xml">
          <Rss aria-hidden="true" size={15} />
          RSS 订阅
        </a>
      </nav>
    </footer>
  );
}
