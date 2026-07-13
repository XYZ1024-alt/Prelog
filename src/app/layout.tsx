import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalyticsTracker } from "@/components/analytics-tracker";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { getSiteSettings } from "@/lib/site-settings";
import { createPageMetadataAlternates, getSiteUrl } from "@/lib/site-url";
import "./globals.css";

// CI and self-hosted builds intentionally run without a live database.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    alternates: createPageMetadataAlternates("/"),
    metadataBase: getSiteUrl(),
    title: {
      default: settings.siteName,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.siteTagline,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
