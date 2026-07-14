import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalyticsTracker } from "@/components/analytics-tracker";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { getSiteSettings } from "@/lib/site-settings";
import { createPageMetadataAlternates, getSiteUrl } from "@/lib/site-url";
import "../styles/public.css";
import "../styles/article.css";

// CI and self-hosted builds intentionally run without a live database.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    alternates: createPageMetadataAlternates("/"),
    description: settings.siteTagline,
    metadataBase: getSiteUrl(),
    title: {
      default: settings.siteName,
      template: `%s | ${settings.siteName}`,
    },
  };
}

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      {children}
      <SiteFooter />
    </>
  );
}
