import { describe, expect, it } from "vitest";

import {
  CATEGORIES_CACHE_TAG,
  POSTS_CACHE_TAG,
  PUBLIC_CONTENT_CACHE_TAG,
  SITE_SETTINGS_CACHE_TAG,
  TAGS_CACHE_TAG,
  createCategoryCacheTag,
  createCategoryMutationCacheTags,
  createCommentMutationCacheTags,
  createPostCacheTag,
  createPostMutationCacheTags,
  createSiteSettingsMutationCacheTags,
  createTagCacheTag,
} from "@/lib/cache-tags";

describe("public content cache tags", () => {
  it("includes aggregate and entity tags for post mutations", () => {
    const tags = createPostMutationCacheTags([
      {
        categorySlug: "Design Systems",
        slug: "Hello World",
        tagSlugs: ["Next.js", "Next.js"],
      },
    ]);

    expect(tags).toEqual([
      PUBLIC_CONTENT_CACHE_TAG,
      POSTS_CACHE_TAG,
      CATEGORIES_CACHE_TAG,
      TAGS_CACHE_TAG,
      createPostCacheTag("Hello World"),
      createCategoryCacheTag("Design Systems"),
      createTagCacheTag("Next.js"),
    ]);
  });

  it("keeps generated cache tags within the Next.js limit", () => {
    expect(createPostCacheTag("slug".repeat(200)).length).toBeLessThanOrEqual(256);
  });

  it("targets category, comment, and site-settings mutations", () => {
    expect(createCategoryMutationCacheTags(["old", "new"])).toEqual([
      PUBLIC_CONTENT_CACHE_TAG,
      POSTS_CACHE_TAG,
      CATEGORIES_CACHE_TAG,
      createCategoryCacheTag("old"),
      createCategoryCacheTag("new"),
    ]);
    expect(createCommentMutationCacheTags("article")).toEqual([
      PUBLIC_CONTENT_CACHE_TAG,
      POSTS_CACHE_TAG,
      createPostCacheTag("article"),
    ]);
    expect(createSiteSettingsMutationCacheTags()).toEqual([
      PUBLIC_CONTENT_CACHE_TAG,
      SITE_SETTINGS_CACHE_TAG,
    ]);
  });
});
