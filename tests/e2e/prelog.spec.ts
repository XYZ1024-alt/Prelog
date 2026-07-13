import { expect, test, type Page } from "@playwright/test";

import { TEST_ADMIN, TEST_POSTS } from "../helpers/seed-test-data.ts";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/admin";
const PUBLISHED_POST_PATH = `/posts/${TEST_POSTS.published.slug}`;
const E2E_POST = {
  content: "## E2E\n\nThis article was created by the browser test.",
  updatedContent: "## E2E\n\nThis article was updated without replacing its locked cover.\n\n## Added section\n\n> Regenerate explicitly.",
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
  await expect(page.locator("[data-glyph-hero-interactive]"))
    .toHaveAttribute("data-glyph-ready", "true");
  await expect(page.locator(".glyph-hero__scene--static")).toHaveCSS("visibility", "hidden");
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
  await expect(page.locator("[data-article-glyph-interactive]")).toHaveAttribute("data-glyph-ready", "true");

  await page.locator('input[name="author"]').fill("E2E Reader");
  await page.locator('input[name="email"]').fill("reader@example.com");
  await page.locator('textarea[name="body"]').fill("This comment should enter moderation.");
  await page.locator(".comment-form button[type='submit']").click();
  await expect(page.locator(".form-success")).toBeVisible();

  await page.goto("/search?q=Search");
  await expect(page.getByRole("link", { exact: true, name: TEST_POSTS.search.title })).toBeVisible();
});

test("enables interactive Glyphs only for fine pointers at 820px and wider", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 820 });
  await page.goto("/");
  await expect(page.locator("[data-glyph-hero-interactive]"))
    .toHaveAttribute("data-glyph-ready", "true");

  await page.goto(PUBLISHED_POST_PATH);
  await expect(page.locator("[data-article-glyph-interactive]"))
    .toHaveAttribute("data-glyph-ready", "true");
});

test("keeps Glyphs static below 820px and with reduced motion", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 819 });
  await page.goto("/");
  await expect(page.locator(".glyph-hero__scene--static")).toBeVisible();
  await expect(page.locator("[data-glyph-hero-interactive]")).toHaveCount(0);

  await page.goto(PUBLISHED_POST_PATH);
  await expect(page.locator(".article-hero .article-glyph--feature")).toBeVisible();
  await expect(page.locator("[data-article-glyph-interactive]")).toHaveCount(0);

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".glyph-hero__scene--static")).toBeVisible();
  await expect(page.locator("[data-glyph-hero-interactive]")).toHaveCount(0);

  await page.goto(PUBLISHED_POST_PATH);
  await expect(page.locator(".article-hero .article-glyph--feature")).toBeVisible();
  await expect(page.locator("[data-article-glyph-interactive]")).toHaveCount(0);
});

test("keeps coarse-pointer tablet Glyphs static without blocking scroll", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { height: 600, width: 1024 },
  });
  const page = await context.newPage();

  try {
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => ({
      coarse: window.matchMedia("(pointer: coarse)").matches,
      hover: window.matchMedia("(hover: hover)").matches,
    }))).toEqual({ coarse: true, hover: false });
    await expect(page.locator(".glyph-hero__scene--static")).toBeVisible();
    await expect(page.locator("[data-glyph-hero-interactive]")).toHaveCount(0);

    await page.goto(PUBLISHED_POST_PATH);
    await expect(page.locator(".article-hero .article-glyph--feature")).toBeVisible();
    await expect(page.locator("[data-article-glyph-interactive]")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > innerHeight))
      .toBe(true);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("interrupts Hero assembly on the first pointerdown", async ({ page }) => {
  await page.addInitScript(() => {
    type HeroInterruptProbe = {
      attempted: boolean;
      interrupted: boolean;
    };
    const targetWindow = window as unknown as { __heroInterruptProbe: HeroInterruptProbe };
    const probe = { attempted: false, interrupted: false };
    targetWindow.__heroInterruptProbe = probe;
    const timer = window.setInterval(() => {
      const host = document.querySelector<HTMLElement>("[data-glyph-hero-interactive]");
      const scene = host?.querySelector<HTMLElement>(".glyph-hero__scene--interactive");
      if (!host || !scene || host.dataset.assembled !== "false") return;

      probe.attempted = true;
      scene.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }));
      if (host.getAttribute("data-assembled") === "true") {
        probe.interrupted = true;
        window.clearInterval(timer);
      }
    }, 4);
  });
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");

  const interactive = page.locator("[data-glyph-hero-interactive]");
  await expect(interactive).toHaveAttribute("data-assembled", "true");
  await expect.poll(() => page.evaluate(() => {
    const targetWindow = window as unknown as {
      __heroInterruptProbe?: { attempted: boolean; interrupted: boolean };
    };
    return targetWindow.__heroInterruptProbe;
  })).toEqual({ attempted: true, interrupted: true });
});

test("assembles the Hero within the GlyphCSS raster budget", async ({ page }) => {
  await page.addInitScript(() => {
    const targetWindow = window as unknown as {
      __glyphPerf: { dom: number[]; polys: number[]; raster: number[] };
    };
    targetWindow.__glyphPerf = { dom: [], polys: [], raster: [] };
  });
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");
  await expect(page.locator("[data-glyph-hero-interactive]"))
    .toHaveAttribute("data-assembled", "true");
  await page.waitForTimeout(100);

  const rasterCount = await page.evaluate(() => {
    const targetWindow = window as unknown as { __glyphPerf?: { raster?: number[] } };
    return targetWindow.__glyphPerf?.raster?.length ?? 0;
  });
  expect(rasterCount).toBeGreaterThan(0);
  expect(rasterCount).toBeLessThanOrEqual(50);
});

test("supports immediate article keyboard rotation and interruptible momentum", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto(PUBLISHED_POST_PATH);
  const interactive = page.locator("[data-article-glyph-interactive]");
  await expect(interactive).toHaveAttribute("data-glyph-ready", "true");
  const scene = interactive.locator(".article-glyph-interactive__scene");
  const initial = await scene.textContent();

  expect(initial?.trim()).toBeTruthy();
  await interactive.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scene.textContent()).not.toBe(initial);
  await page.keyboard.press("Home");
  await expect.poll(() => scene.textContent()).toBe(initial);

  await expectGlyphMomentum(page, scene);
  await interactive.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => scene.textContent()).toBe(initial);
});

test("lets an administrator create and publish a post", async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN_PATH}/posts/new`);

  await page.locator('input[name="title"]').fill(E2E_POST.title);
  await page.locator('input[name="slug"]').fill(E2E_POST.slug);
  await page.locator('textarea[name="excerpt"]').fill("Excerpt from the E2E test.");
  await page.locator('input[name="tagNames"]').fill("Next.js, next.js");
  await page.locator(".markdown-editor__textarea").fill(E2E_POST.content);
  await expect(page.locator(".post-cover-preview .article-glyph")).toBeVisible();
  await page.locator('select[name="status"]').selectOption("PUBLISHED");
  await page.locator("form.post-editor button[type='submit']").click();

  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts/.+/edit`));
  await expect(page.locator('input[name="tagNames"]')).toHaveValue("Next.js");
  const editUrl = page.url();
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.getByRole("heading", { name: E2E_POST.title })).toBeVisible();
  const lockedPublishedAt = await page.locator(".article-meta time").getAttribute("datetime");
  expect(lockedPublishedAt).toBeTruthy();
  const articleGlyph = page.locator(".article-hero .article-glyph");
  await expect(articleGlyph).toBeVisible();
  await expect(articleGlyph).toHaveAttribute("data-glyph-initial", "E");
  const lockedHash = await articleGlyph.getAttribute("data-glyph-hash");
  expect(lockedHash).toMatch(/^[0-9a-f]{16}$/);
  await expectInteractiveGlyphDrag(page, lockedHash!);

  await page.setViewportSize({ height: 900, width: 819 });
  await expect(page.locator("[data-article-glyph-interactive]")).toHaveCount(0);
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("[data-article-glyph-interactive]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const ogImageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImageUrl).toBeTruthy();
  const ogResponse = await page.request.get(ogImageUrl!);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");
  expect((await ogResponse.body()).byteLength).toBeGreaterThan(1_000);
  const unversionedOgImageUrl = new URL(ogImageUrl!);
  unversionedOgImageUrl.search = "";
  const ogRedirect = await page.request.get(unversionedOgImageUrl.toString(), { maxRedirects: 0 });
  expect(ogRedirect.status()).toBe(307);
  expect(ogRedirect.headers().location).toBe(ogImageUrl);

  await page.goto(editUrl);
  await page.locator(".markdown-editor__textarea").fill(E2E_POST.updatedContent);
  await page.locator("form.post-editor > button[type='submit']").click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts$`));
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.locator(".article-hero .article-glyph")).toHaveAttribute("data-glyph-hash", lockedHash!);
  await expect(page.locator(".article-meta time")).toHaveAttribute("datetime", lockedPublishedAt!);

  await page.goto(editUrl);
  await page.getByRole("button", { name: "重新生成" }).click();
  await expect(page).toHaveURL(/cover=regenerated/);
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.locator(".article-hero .article-glyph")).not.toHaveAttribute("data-glyph-hash", lockedHash!);
  await expect(page.locator(".article-meta time")).toHaveAttribute("datetime", lockedPublishedAt!);

  await page.goto(editUrl);
  await page.locator('input[name="coverMode"][value="MANUAL"]').check();
  await page.locator('input[name="coverImage"]').fill("https://example.com/cover.png");
  await page.locator("form.post-editor > button[type='submit']").click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts$`));
  await page.goto(`/posts/${E2E_POST.slug}`);
  const manualModifiedAt = await page.locator('meta[property="article:modified_time"]').getAttribute("content");
  expect(manualModifiedAt).toBeTruthy();
  await page.goto(editUrl);
  await page.locator('input[name="coverMode"][value="GLYPH"]').check();
  await page.locator(".post-cover-glyph__regenerate").click();
  await expect(page).toHaveURL(/cover=regenerated/);
  await expect(page.locator('input[name="coverMode"][value="MANUAL"]')).toBeChecked();
  await page.goto(`/posts/${E2E_POST.slug}`);
  await expect(page.locator('meta[property="article:modified_time"]')).toHaveAttribute("content", manualModifiedAt!);

  const staleEditor = await page.context().newPage();
  try {
    await Promise.all([page.goto(editUrl), staleEditor.goto(editUrl)]);
    await page.locator('textarea[name="excerpt"]').fill("Saved from the first editor.");
    await page.locator("form.post-editor > button[type='submit']").click();
    await expect(page).toHaveURL(new RegExp(`${ADMIN_PATH}/posts$`));

    await staleEditor.locator('textarea[name="excerpt"]').fill("Stale editor content.");
    await staleEditor.locator("form.post-editor > button[type='submit']").click();
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

async function expectInteractiveGlyphDrag(page: Page, sourceHash: string) {
  const interactive = page.locator("[data-article-glyph-interactive]");
  await expect(interactive).toHaveAttribute("data-glyph-ready", "true");
  await expect(interactive).toHaveAttribute("data-glyph-hash", sourceHash);
  const scene = interactive.locator(".article-glyph-interactive__scene");
  const before = await scene.textContent();
  const bounds = await scene.boundingBox();

  expect(before?.trim()).toBeTruthy();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.35, bounds!.y + bounds!.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.68, bounds!.y + bounds!.height * 0.62, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => scene.textContent()).not.toBe(before);
  await page.waitForTimeout(400);

  await interactive.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => scene.textContent()).toBe(before);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scene.textContent()).not.toBe(before);
}

async function expectGlyphMomentum(page: Page, scene: ReturnType<Page["locator"]>) {
  const bounds = await scene.boundingBox();
  expect(bounds).not.toBeNull();
  const start = {
    x: bounds!.x + bounds!.width * 0.3,
    y: bounds!.y + bounds!.height * 0.45,
  };
  const end = {
    x: bounds!.x + bounds!.width * 0.72,
    y: bounds!.y + bounds!.height * 0.62,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(20);
  await page.mouse.move(end.x, end.y, { steps: 2 });
  await page.mouse.up();
  const atRelease = await scene.textContent();
  await page.waitForTimeout(100);
  expect(await scene.textContent()).not.toBe(atRelease);

  await page.waitForTimeout(350);
  const settled = await scene.textContent();
  await page.waitForTimeout(180);
  expect(await scene.textContent()).toBe(settled);
}
