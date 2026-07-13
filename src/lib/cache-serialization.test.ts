import { describe, expect, it } from "vitest";

import { deserializeCacheValue, serializeCacheValue } from "@/lib/cache-serialization";

describe("public cache serialization", () => {
  it("preserves nested dates across a JSON cache round trip", () => {
    const publishedAt = new Date("2026-07-13T12:00:00.000Z");
    const serialized = serializeCacheValue({
      posts: [{ publishedAt, tags: [{ createdAt: publishedAt }] }],
    });
    const cachedValue = JSON.parse(JSON.stringify(serialized)) as unknown;
    const restored = deserializeCacheValue(cachedValue) as {
      posts: { publishedAt: Date; tags: { createdAt: Date }[] }[];
    };

    expect(restored.posts[0]?.publishedAt).toEqual(publishedAt);
    expect(restored.posts[0]?.tags[0]?.createdAt).toEqual(publishedAt);
  });

  it("does not mutate the source value", () => {
    const source = { createdAt: new Date("2026-07-13T12:00:00.000Z") };

    serializeCacheValue(source);

    expect(source.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a malformed serialized date", () => {
    expect(() => deserializeCacheValue({ __prelog_cache_date_v1__: "not-a-date" })).toThrow(
      "Cached date is invalid.",
    );
  });
});
