import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";

import { ThemeProvider } from "@/components/theme-provider";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const sansFont = localFont({
  display: "swap",
  src: [
    { path: "../../public/fonts/inter-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "../../public/fonts/inter-latin-500-normal.woff2", style: "normal", weight: "500" },
    { path: "../../public/fonts/inter-latin-700-normal.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-sans",
});

const monoFont = localFont({
  display: "swap",
  src: [
    { path: "../../public/fonts/jetbrains-mono-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "../../public/fonts/jetbrains-mono-latin-700-normal.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-mono",
});

const THEME_INITIALIZER = `(() => {
  try {
    const stored = localStorage.getItem("prelog-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    }
  } catch (error) {
    console.warn("Unable to read the saved Prelog theme.", error);
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
      <body className={`${sansFont.variable} ${monoFont.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
