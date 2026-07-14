import type { Metadata } from "next";
import Script from "next/script";

import { ThemeProvider } from "@/components/theme-provider";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const THEME_INITIALIZER = `(() => {
  try {
    const stored = localStorage.getItem("prelog-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    console.warn("Unable to read the saved Prelog theme.", error);
    document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
})();`;

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: "Prelog",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script
          dangerouslySetInnerHTML={{ __html: THEME_INITIALIZER }}
          id="prelog-theme-initializer"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
