import { expect, test, type Locator, type Page } from "@playwright/test";

import { TEST_ADMIN } from "../helpers/seed-test-data.ts";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/admin";
const ALLOWED_COVER_URL = "https://example.com/prelog-manual-cover-e2e.png";
const DISALLOWED_COVER_URL = "https://images.invalid/prelog-manual-cover-e2e.png";
const MANUAL_POST = {
  slug: "manual-cover-surface-audit",
  title: "Manual Cover Surface Audit",
} as const;
const FOLLOWER_POST = {
  slug: "manual-cover-follower",
  title: "Manual Cover Follower",
} as const;
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("keeps manual covers allowlisted and private across every public image surface", async ({ page }) => {
  const disallowedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url() === DISALLOWED_COVER_URL) disallowedRequests.push(request.url());
  });
  await page.route(ALLOWED_COVER_URL, (route) => route.fulfill({
    body: TRANSPARENT_PNG,
    contentType: "image/png",
    status: 200,
  }));

  await login(page);
  await createManualPost(page, disallowedRequests);
  await createFollowerPost(page);

  await expectPublicCover(
    page,
    "/",
    `.index-entry:has(a[href="/posts/${MANUAL_POST.slug}"]) .index-entry__image`,
  );
  await expectPublicCover(
    page,
    "/categories/engineering",
    `.post-card:has(a[href="/posts/${MANUAL_POST.slug}"]) .post-card__image`,
  );
  await expectPublicCover(
    page,
    `/search?q=${encodeURIComponent(MANUAL_POST.title)}`,
    `.search-result-card:has(a[href="/posts/${MANUAL_POST.slug}"]) .search-result-card__image`,
  );
  await expectPublicCover(
    page,
    `/posts/${MANUAL_POST.slug}`,
    ".article-hero__visual-frame--manual img",
  );
});

async function login(page: Page) {
  await page.goto(`${ADMIN_PATH}/login`);
  await page.locator('input[name="email"]').fill(TEST_ADMIN.email);
  await page.locator('input[name="password"]').fill(TEST_ADMIN.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
}

async function createManualPost(page: Page, disallowedRequests: readonly string[]) {
  await page.goto(`${ADMIN_PATH}/posts/new`);
  await fillRequiredPostFields(page, MANUAL_POST, "A manual cover used to audit every public image surface.");
  await page.locator('select[name="categoryId"]').selectOption({ label: "Engineering" });
  await expect(page.locator(".post-cover-mode")).toHaveAttribute("data-client-ready", "true");
  await page.locator('input[name="coverMode"][value="MANUAL"]').check();

  const coverInput = page.locator('input[name="coverImage"]');
  await coverInput.fill(DISALLOWED_COVER_URL);
  await expect(page.locator(".post-cover-manual__preview img")).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(disallowedRequests).toHaveLength(0);

  await coverInput.fill(ALLOWED_COVER_URL);
  await expectNoReferrerCover(page.locator(".post-cover-manual__preview img"));
  await publishCurrentPost(page);
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts/.+/edit`));
}

async function createFollowerPost(page: Page) {
  await page.evaluate(() => window.localStorage.removeItem("prelog:post-form-draft:v4:post:new"));
  await page.goto(`${ADMIN_PATH}/posts/new`);
  await fillRequiredPostFields(page, FOLLOWER_POST, "Keeps the audited manual cover in the home writing index.");
  await publishCurrentPost(page);
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts/.+/edit`));
}

async function fillRequiredPostFields(
  page: Page,
  post: { readonly slug: string; readonly title: string },
  excerpt: string,
) {
  await page.locator('input[name="title"]').fill(post.title);
  await page.locator('input[name="slug"]').fill(post.slug);
  await page.locator('textarea[name="excerpt"]').fill(excerpt);
  await page.locator(".markdown-editor__textarea").fill(`## ${post.title}\n\n${excerpt}`);
}

async function publishCurrentPost(page: Page) {
  await page.locator('select[name="status"]').selectOption("PUBLISHED");
  await page.locator('form.post-editor > button[type="submit"]').click();
}

async function expectPublicCover(page: Page, path: string, selector: string) {
  await page.goto(path);
  await expectNoReferrerCover(page.locator(selector));
}

async function expectNoReferrerCover(cover: Locator) {
  await expect(cover).toHaveCount(1);
  await expect(cover).toHaveAttribute("src", ALLOWED_COVER_URL);
  await expect(cover).toHaveAttribute("referrerpolicy", "no-referrer");
}
