import { expect, test, type Page } from "@playwright/test";

import { TEST_ADMIN, TEST_POSTS } from "../helpers/seed-test-data.ts";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/admin";
const E2E_POST = {
  content: "## E2E\n\nThis article was created by the browser test.",
  slug: "e2e-published-post",
  title: "E2E Published Post",
} as const;

test("redirects anonymous admin visitors to login", async ({ page }) => {
  await page.goto(ADMIN_PATH);

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/login`));
});

test("supports public reading, search, and comment submission", async ({ page }) => {
  await page.goto("/");
  const postLink = page.getByRole("link", { exact: true, name: TEST_POSTS.published.title });

  await expect(postLink).toBeVisible();
  await postLink.click();
  await expect(page.getByRole("heading", { name: TEST_POSTS.published.title })).toBeVisible();

  await page.locator('input[name="author"]').fill("E2E Reader");
  await page.locator('input[name="email"]').fill("reader@example.com");
  await page.locator('textarea[name="body"]').fill("This comment should enter moderation.");
  await page.locator(".comment-form button[type='submit']").click();
  await expect(page.locator(".form-success")).toBeVisible();

  await page.goto("/search?q=Search");
  await expect(page.getByRole("link", { name: TEST_POSTS.search.title })).toBeVisible();
});

test("lets an administrator create and publish a post", async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN_PATH}/posts/new`);

  await page.locator('input[name="title"]').fill(E2E_POST.title);
  await page.locator('input[name="slug"]').fill(E2E_POST.slug);
  await page.locator('textarea[name="excerpt"]').fill("Excerpt from the E2E test.");
  await page.locator(".markdown-editor__textarea").fill(E2E_POST.content);
  await page.locator('select[name="status"]').selectOption("PUBLISHED");
  await page.locator("form.post-editor button[type='submit']").click();

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts/.+/edit`));
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.getByRole("heading", { name: E2E_POST.title })).toBeVisible();
});

test("lets an administrator update public site settings", async ({ page }) => {
  const nextSiteName = "Updated Test Prelog";

  await login(page);
  await page.goto(`${ADMIN_PATH}/settings`);
  await page.locator('input[name="siteName"]').fill(nextSiteName);
  await page.locator('input[name="siteTagline"]').fill("Updated from Playwright");
  await page.locator('form:has(input[name="siteName"]) button[type="submit"]').click();

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/settings\\?updated=site`));
  await page.goto("/");
  await expect(page.getByText(nextSiteName).first()).toBeVisible();
});

async function login(page: Page) {
  await page.goto(`${ADMIN_PATH}/login`);
  await page.locator('input[name="email"]').fill(TEST_ADMIN.email);
  await page.locator('input[name="password"]').fill(TEST_ADMIN.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
}
