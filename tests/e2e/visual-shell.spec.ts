import { expect, test, type Page } from "@playwright/test";

import { TEST_ADMIN, TEST_POSTS } from "../helpers/seed-test-data.ts";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/admin";
const ARTICLE_PATH = `/posts/${TEST_POSTS.published.slug}`;
const SINGLE_HEADING_ARTICLE_PATH = `/posts/${TEST_POSTS.search.slug}`;
const VIEWPORT_HEIGHT = 900;

test("supports the mobile navigation menu and restores focus on Escape", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  const toggle = page.locator(".site-nav-toggle:visible");
  await expect(toggle).toHaveAccessibleName("打开导航");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(toggle).toHaveAccessibleName("关闭导航");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("initializes and persists the selected theme", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "主题：跟随系统主题，点击切换" })).toBeVisible();
  await page.evaluate(() => window.localStorage.setItem("prelog-theme", "dark"));
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "主题：深色主题，点击切换" }).click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBeNull();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("prelog-theme"))).toBeNull();

  await page.getByRole("button", { name: "主题：跟随系统主题，点击切换" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("prelog-theme"))).toBe("light");
});

test("keeps the admin login inside its independent application frame", async ({ page }) => {
  await page.goto(`${ADMIN_PATH}/login`);

  await expect(page.locator(".admin-login")).toBeVisible();
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(page.locator(".site-footer")).toHaveCount(0);
});

test("supports the mobile admin navigation menu and restores focus on Escape", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await login(page);

  const toggle = page.locator(".admin-nav__toggle:visible");
  await expect(toggle).toHaveAccessibleName("打开后台导航");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "文章管理" })).toBeHidden();
  await toggle.click();
  await expect(page.getByRole("link", { name: "文章管理" })).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("keeps admin row action buttons aligned", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await login(page);
  await page.goto(`${ADMIN_PATH}/posts`);

  const buttons = page.locator(".admin-row__actions").first().locator(".button");
  await expect(buttons).toHaveCount(3);
  const boxes = await buttons.evaluateAll((elements) => elements.map((element) => {
    const { height, y } = element.getBoundingClientRect();
    return { height, y };
  }));
  const heights = new Set(boxes.map(({ height }) => height));
  const verticalOffsets = new Set(boxes.map(({ y }) => y));

  expect(heights).toEqual(new Set([36]));
  expect(verticalOffsets.size).toBe(1);
});

test("hides a single-heading table of contents and omits missing navigation items", async ({ page }) => {
  await page.goto(SINGLE_HEADING_ARTICLE_PATH);

  await expect(page.locator(".article-toc")).toHaveCount(0);
  await expect(page.locator(".article-navigation:visible")).toBeVisible();

  await page.goto(ARTICLE_PATH);
  await expect(page.locator(".article-navigation__item:visible")).toHaveCount(1);
});

test("updates article progress when the active section changes", async ({ page }) => {
  await page.goto(ARTICLE_PATH);

  const progress = page.getByRole("progressbar", { name: "章节进度" });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await page.locator("#delivery:visible").evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(progress).toHaveAttribute("aria-valuenow", "100");
});

test("centers the article heading region at target viewports", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });
    await page.goto(ARTICLE_PATH);

    const layout = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".article-shell")?.getBoundingClientRect();
      const copy = document.querySelector<HTMLElement>(".article-hero__copy")?.getBoundingClientRect();

      if (!shell || !copy) {
        throw new Error("Article heading layout targets are unavailable.");
      }

      return {
        centerDelta: Math.abs((shell.left + shell.width / 2) - (copy.left + copy.width / 2)),
        overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    expect(layout.centerDelta).toBeLessThanOrEqual(0.5);
    expect(layout.overflows).toBe(false);
  }
});

test("exposes clipboard failures instead of reporting false success", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Clipboard unavailable in test.")) },
    });
  });
  await page.goto(ARTICLE_PATH);

  const copyButton = page.getByRole("button", { name: "复制代码" }).first();
  await copyButton.click();
  await expect(copyButton).toHaveAttribute("data-copy-state", "error");
  await expect(copyButton).toContainText("复制失败");
});

test("keeps primary controls and secondary copy above WCAG AA contrast", async ({ page }) => {
  await page.goto("/friends");

  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);

    const ratios = await getPageContrastRatios(page);
    expect(ratios.button).toBeGreaterThanOrEqual(4.5);
    expect(ratios.secondary).toBeGreaterThanOrEqual(4.5);
  }

  await page.goto("/");

  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    await expect.poll(() => getElementContrastRatio(page, ".home-hero__description"))
      .toBeGreaterThanOrEqual(4.5);
  }
});

test("avoids root horizontal overflow at target viewports", async ({ page }) => {
  test.setTimeout(60_000);
  const paths = ["/", ARTICLE_PATH, "/archive", "/friends", "/search?q=Prisma", `${ADMIN_PATH}/login`];

  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });

    for (const path of paths) {
      await page.goto(path);
      await expect.poll(() => page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )), { message: `${path} should not overflow at ${width}px` }).toBe(true);
    }
  }
});

async function login(page: Page) {
  await page.goto(`${ADMIN_PATH}/login`);
  await page.locator('input[name="email"]:visible').fill(TEST_ADMIN.email);
  await page.locator('input[name="password"]:visible').fill(TEST_ADMIN.password);
  await page.locator('button[type="submit"]:visible').click();
  await expect(page.locator(".admin-owner-card p:visible")).toHaveText(TEST_ADMIN.email);
}

async function getPageContrastRatios(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(".button--primary");
    const secondary = document.querySelector<HTMLElement>(".page-heading p");
    if (!button || !secondary) throw new Error("Contrast targets are unavailable.");

    function parseRgb(value: string) {
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${value}`);
      return channels;
    }

    function luminance(value: string) {
      const linear = parseRgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }

    function contrast(foreground: string, background: string) {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      const lighter = Math.max(foregroundLuminance, backgroundLuminance);
      const darker = Math.min(foregroundLuminance, backgroundLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const buttonStyle = getComputedStyle(button);
    return {
      button: contrast(buttonStyle.color, buttonStyle.backgroundColor),
      secondary: contrast(getComputedStyle(secondary).color, getComputedStyle(document.body).backgroundColor),
    };
  });
}

async function getElementContrastRatio(page: Page, selector: string) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!target) throw new Error(`Contrast target is unavailable: ${targetSelector}`);

    function luminance(value: string) {
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${value}`);
      const linear = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }

    const style = getComputedStyle(target);
    let backgroundTarget: HTMLElement | null = target;

    while (backgroundTarget) {
      const background = getComputedStyle(backgroundTarget).backgroundColor;
      if (background !== "transparent" && background !== "rgba(0, 0, 0, 0)") break;
      backgroundTarget = backgroundTarget.parentElement;
    }

    if (!backgroundTarget) throw new Error(`Contrast background is unavailable: ${targetSelector}`);
    const foreground = luminance(style.color);
    const background = luminance(getComputedStyle(backgroundTarget).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  }, selector);
}

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((value) => {
    window.localStorage.setItem("prelog-theme", value);
    document.documentElement.dataset.theme = value;
  }, theme);
}
