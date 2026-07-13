import { afterEach, describe, expect, test, vi } from "vitest";

const cacheProbe = vi.hoisted(() => ({ calls: vi.fn() }));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((query: (...args: unknown[]) => Promise<unknown>) => (
    async (...args: unknown[]) => {
      cacheProbe.calls(...args);
      return query(...args);
    }
  )),
}));

import { createPublicCachedQuery } from "@/lib/public-cache";

afterEach(() => {
  cacheProbe.calls.mockClear();
  vi.unstubAllEnvs();
});

describe("createPublicCachedQuery", () => {
  test("bypasses the persistent Next cache when E2E isolation is enabled", async () => {
    vi.stubEnv("PRELOG_DISABLE_PUBLIC_CACHE", "true");
    const query = vi.fn(async (value: string) => ({ value }));
    const read = createPublicCachedQuery(query, ["test"]);

    await expect(read("fresh")).resolves.toEqual({ value: "fresh" });
    expect(query).toHaveBeenCalledWith("fresh");
    expect(cacheProbe.calls).not.toHaveBeenCalled();
  });

  test("uses the persistent cache when isolation is disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRELOG_DISABLE_PUBLIC_CACHE", "false");
    const query = vi.fn(async (value: string) => ({ value }));
    const read = createPublicCachedQuery(query, ["test"]);

    await expect(read("cached")).resolves.toEqual({ value: "cached" });
    expect(cacheProbe.calls).toHaveBeenCalledWith("cached");
  });
});
