import { describe, expect, test } from "vitest";

import nextConfig from "../../next.config.ts";

describe("preview response headers", () => {
  test("prevents caching, indexing, and referrer disclosure", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers?.();
    const previewRule = rules?.find((rule) => rule.source === "/preview/:path*");

    expect(previewRule?.headers).toEqual(expect.arrayContaining([
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ]));
  });
});
