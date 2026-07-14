import { expect, test, type Page } from "@playwright/test";

import { TEST_ADMIN, TEST_FRIEND_LINKS } from "../helpers/seed-test-data.ts";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/admin";
const E2E_FRIEND_NAME = "E2E Friend Notes";

test("renders only public friend links with canonical external-link semantics", async ({ page }) => {
  await page.goto("/friends");

  await expect(page.getByRole("heading", { level: 1, name: "友情链接" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(TEST_FRIEND_LINKS.visible.name) })).toBeVisible();
  await expect(page.getByText(TEST_FRIEND_LINKS.hidden.name)).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/friends$/);

  const externalLink = page.getByRole("link", { name: new RegExp(TEST_FRIEND_LINKS.visible.name) });
  await expect(externalLink).toHaveAttribute("target", "_blank");
  await expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(externalLink.locator(".friend-logo--fallback")).toContainText("V");
});

test("supports friend CRUD, visibility, and the public-page switch", async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN_PATH}/friends/new`);
  await page.locator('input[name="name"]:visible').fill(E2E_FRIEND_NAME);
  await page.locator('input[name="url"]:visible').fill("https://e2e-friend.example.com");
  await page.locator('textarea[name="description"]:visible').fill("Created by the friend-link browser workflow.");
  await page.locator('input[name="sortOrder"]:visible').fill("2");
  await page.getByRole("button", { name: "保存友链" }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/friends\\?created=1`));

  let row = page.locator(".admin-row--friend").filter({ hasText: E2E_FRIEND_NAME });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "编辑" }).click();
  await page.locator('textarea[name="description"]:visible').fill("Updated by the friend-link browser workflow.");
  await page.getByRole("button", { name: "保存友链" }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/friends\\?updated=1`));

  row = page.locator(".admin-row--friend").filter({ hasText: E2E_FRIEND_NAME });
  await expect(row).toContainText("Updated by the friend-link browser workflow.");
  await row.getByRole("button", { name: "隐藏" }).click();
  await expect(row.locator('.admin-friend-title [data-visible="false"]')).toHaveText("隐藏");
  await page.goto("/friends");
  await expect(page.getByText(E2E_FRIEND_NAME)).toHaveCount(0);

  await page.goto(`${ADMIN_PATH}/friends`);
  row = page.locator(".admin-row--friend").filter({ hasText: E2E_FRIEND_NAME });
  await row.getByRole("button", { name: "公开" }).click();
  await expect(row.locator('.admin-friend-title [data-visible="true"]')).toHaveText("公开");

  const enabledSwitch = page.getByRole("switch", { name: /启用友链页面与导航/ });
  await enabledSwitch.uncheck();
  await page.getByRole("button", { name: "保存友链设置" }).click();
  await expect(page.getByText("友链设置已保存。")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "友链" })).toHaveCount(0);
  await page.goto("/friends");
  await expect(page.getByRole("heading", { level: 1, name: "没有找到这个页面" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);

  await page.goto(`${ADMIN_PATH}/friends`);
  await page.getByRole("switch", { name: /启用友链页面与导航/ }).check();
  await page.getByRole("button", { name: "保存友链设置" }).click();
  await expect(page.getByText("友链设置已保存。")).toBeVisible();
  await page.goto("/friends");
  await expect(page.getByText(E2E_FRIEND_NAME)).toBeVisible();

  await page.goto(`${ADMIN_PATH}/friends`);
  row = page.locator(".admin-row--friend").filter({ hasText: E2E_FRIEND_NAME });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "删除" }).click();
  await expect(row).toHaveCount(0);
});

async function login(page: Page) {
  await page.goto(`${ADMIN_PATH}/login`);
  await page.locator('input[name="email"]:visible').fill(TEST_ADMIN.email);
  await page.locator('input[name="password"]:visible').fill(TEST_ADMIN.password);
  await page.locator('button[type="submit"]:visible').click();
  await expect(page.locator(".admin-owner-card p:visible")).toHaveText(TEST_ADMIN.email);
}
