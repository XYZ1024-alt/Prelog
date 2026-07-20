import { expect, test, type Page } from "@playwright/test";

import { TEST_ADMIN, TEST_POSTS } from "../helpers/seed-test-data.ts";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/admin";
const E2E_POST = {
  content: "## E2E\n\nThis article was created by the browser test.",
  updatedContent: "## E2E\n\nThis article was updated after publication.\n\n## Added section\n\n> Preserve the publication date.",
  slug: "e2e-published-post",
  title: "E2E Published Post",
} as const;

test("redirects anonymous admin visitors to login", async ({ page }) => {
  await page.goto(ADMIN_PATH);

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/login`));
});

test("supports public reading, search, and comment submission", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");
  await expect(page.locator(".home-hero:visible")).toBeVisible();
  const postLink = page.getByRole("link", { exact: true, name: TEST_POSTS.published.title });

  await expect(postLink).toBeVisible();
  await postLink.click();
  await expect(page.getByRole("heading", { name: TEST_POSTS.published.title })).toBeVisible();
  await expect(page.locator(".markdown-body")).toBeVisible();
  await expect(page.getByRole("link", { name: "semantic links" })).toBeVisible();
  await expect(page.locator(".markdown-body ol")).toBeVisible();
  await expect(page.locator(".markdown-body table")).toBeVisible();
  await expect(page.locator(".markdown-body .code-block")).toHaveCount(2);

  await page.getByRole("link", { name: "semantic links" }).focus();
  await expect(page.getByRole("link", { name: "semantic links" })).toBeFocused();

  await page.setViewportSize({ height: 900, width: 820 });
  await expect(page.locator(".markdown-body")).toBeVisible();
  await expect(page.getByRole("link", { name: "semantic links" })).toBeVisible();

  await page.locator('input[name="author"]').fill("E2E Reader");
  await page.locator('input[name="email"]').fill("reader@example.com");
  await page.locator('textarea[name="body"]').fill("This comment should enter moderation.");
  await page.locator(".comment-form button[type='submit']").click();
  await expect(page.locator(".form-success")).toBeVisible();

  await page.goto("/search?q=Search");
  await expect(page.getByRole("link", { exact: true, name: TEST_POSTS.search.title })).toBeVisible();
});

test("lets an administrator create and publish a post", async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN_PATH}/posts/new`);

  await page.locator('input[name="title"]:visible').fill(E2E_POST.title);
  await page.locator('input[name="slug"]:visible').fill(E2E_POST.slug);
  await page.locator('textarea[name="excerpt"]:visible').fill("Excerpt from the E2E test.");
  await page.locator('input[name="tagNames"]:visible').fill("Next.js, next.js");
  await page.locator(".markdown-editor__textarea:visible").fill(E2E_POST.content);
  await page.locator('select[name="status"]:visible').selectOption("PUBLISHED");
  await page.locator("form.post-editor:visible button[type='submit']").click();

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts/.+/edit`));
  await expect(page.locator('input[name="tagNames"]:visible')).toHaveValue("Next.js");
  const editUrl = page.url();
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.getByRole("heading", { name: E2E_POST.title })).toBeVisible();
  const lockedPublishedAt = await page.locator(".article-meta time:visible").getAttribute("datetime");
  expect(lockedPublishedAt).toBeTruthy();

  const ogImageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImageUrl).toBeTruthy();
  const ogResponse = await page.request.get(ogImageUrl!);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");
  expect((await ogResponse.body()).byteLength).toBeGreaterThan(1_000);

  await page.goto(editUrl);
  await page.locator(".markdown-editor__textarea:visible").fill(E2E_POST.updatedContent);
  await page.locator("form.post-editor:visible > button[type='submit']").click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts$`));
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.locator(".markdown-body")).toContainText("Preserve the publication date.");
  await expect(page.locator(".article-meta time:visible"))
    .toHaveAttribute("datetime", lockedPublishedAt!);

  const staleEditor = await page.context().newPage();
  try {
    await Promise.all([page.goto(editUrl), staleEditor.goto(editUrl)]);
    await page.locator('textarea[name="excerpt"]:visible').fill("Saved from the first editor.");
    await page.locator("form.post-editor:visible > button[type='submit']").click();
    await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts$`));

    await staleEditor.locator('textarea[name="excerpt"]:visible').fill("Stale editor content.");
    await staleEditor.locator("form.post-editor:visible > button[type='submit']").click();
    await expect(staleEditor.locator(".post-editor .form-error")).toContainText("文章已被其他页面修改");
    await expect(staleEditor).toHaveURL(new RegExp(`${ADMIN_PATH}/posts/.+/edit`));
  } finally {
    await staleEditor.close();
  }
});

test("lets an administrator update public site settings", async ({ page }) => {
  const nextSiteName = "Updated Test Prelog";

  await login(page);
  await page.goto(`${ADMIN_PATH}/settings`);
  await page.locator('input[name="siteName"]:visible').fill(nextSiteName);
  await page.locator('input[name="siteTagline"]:visible').fill("Updated from Playwright");
  await page.locator('form:has(input[name="siteName"]):visible button[type="submit"]').click();

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/settings\\?updated=site`));
  await page.goto("/");
  await expect(page.getByText(nextSiteName).first()).toBeVisible();
});

async function login(page: Page) {
  await page.goto(`${ADMIN_PATH}/login`);
  await page.locator('input[name="email"]:visible').fill(TEST_ADMIN.email);
  await page.locator('input[name="password"]:visible').fill(TEST_ADMIN.password);
  await page.locator('button[type="submit"]:visible').click();
  await expect(page.locator(".admin-owner-card p:visible")).toHaveText(TEST_ADMIN.email);
}
