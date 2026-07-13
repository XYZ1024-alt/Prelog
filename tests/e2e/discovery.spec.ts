import { expect, test } from "@playwright/test";

import { TEST_POSTS } from "../helpers/seed-test-data.ts";

test("exposes archives, canonical URLs, related reading, and feeds", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new URL(page.url()).origin);

  await page.goto("/about");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", page.url());

  await page.goto("/archive");
  await expect(page.getByRole("heading", { level: 1, name: "文章归档" })).toBeVisible();
  await expect(page.getByRole("link", { exact: true, name: TEST_POSTS.published.title })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/archive$/);

  await page.goto(`/posts/${TEST_POSTS.published.slug}`);
  await expect(page.getByRole("heading", { level: 2, name: "继续阅读" })).toBeVisible();
  await expect(page.getByRole("link", { exact: true, name: TEST_POSTS.search.title })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/posts/${TEST_POSTS.published.slug}$`),
  );

  await page.goto("/search?q=Prisma");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const [rss, sitemap, robots] = await Promise.all([
    request.get("/rss.xml"),
    request.get("/sitemap.xml"),
    request.get("/robots.txt"),
  ]);
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(rss.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
  expect(await rss.text()).toContain(TEST_POSTS.published.title);
  expect(await sitemap.text()).not.toContain(TEST_POSTS.draft.slug);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Allow: /api/og/");
  expect(robotsBody).toContain("Disallow: /preview");
  expect(robotsBody).not.toContain("Disallow: /search");
});
