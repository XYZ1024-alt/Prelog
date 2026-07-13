export const PUBLIC_CONTENT_CACHE_TAG = "prelog:public-content";
export const SITE_SETTINGS_CACHE_TAG = "prelog:site-settings";
export const POSTS_CACHE_TAG = "prelog:posts";
export const CATEGORIES_CACHE_TAG = "prelog:categories";
export const TAGS_CACHE_TAG = "prelog:tags";
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 60 * 60;

const CACHE_TAG_SEGMENT_MAX = 180;

export type PublicContentCacheTarget = {
  readonly categorySlug: string | null;
  readonly slug: string;
  readonly tagSlugs: readonly string[];
};

export function createPostCacheTag(slug: string) {
  return `prelog:post:${createCacheTagSegment(slug)}`;
}

export function createCategoryCacheTag(slug: string) {
  return `prelog:category:${createCacheTagSegment(slug)}`;
}

export function createTagCacheTag(slug: string) {
  return `prelog:tag:${createCacheTagSegment(slug)}`;
}

export function createPostMutationCacheTags(targets: readonly PublicContentCacheTarget[]) {
  const tags = new Set([
    PUBLIC_CONTENT_CACHE_TAG,
    POSTS_CACHE_TAG,
    CATEGORIES_CACHE_TAG,
    TAGS_CACHE_TAG,
  ]);

  for (const target of targets) {
    tags.add(createPostCacheTag(target.slug));

    if (target.categorySlug) {
      tags.add(createCategoryCacheTag(target.categorySlug));
    }

    target.tagSlugs.forEach((slug) => tags.add(createTagCacheTag(slug)));
  }

  return Array.from(tags);
}

export function createCategoryMutationCacheTags(slugs: readonly string[]) {
  return Array.from(new Set([
    PUBLIC_CONTENT_CACHE_TAG,
    POSTS_CACHE_TAG,
    CATEGORIES_CACHE_TAG,
    ...slugs.map(createCategoryCacheTag),
  ]));
}

export function createCommentMutationCacheTags(slug: string) {
  return [PUBLIC_CONTENT_CACHE_TAG, POSTS_CACHE_TAG, createPostCacheTag(slug)];
}

export function createSiteSettingsMutationCacheTags() {
  return [PUBLIC_CONTENT_CACHE_TAG, SITE_SETTINGS_CACHE_TAG];
}

function createCacheTagSegment(value: string) {
  return encodeURIComponent(value.trim().toLowerCase()).slice(0, CACHE_TAG_SEGMENT_MAX);
}
