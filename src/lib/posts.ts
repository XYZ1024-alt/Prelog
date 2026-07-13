import type { Prisma } from "@/generated/prisma/client";
import { cache } from "react";

import {
  CATEGORIES_CACHE_TAG,
  POSTS_CACHE_TAG,
  TAGS_CACHE_TAG,
  createCategoryCacheTag,
  createPostCacheTag,
  createTagCacheTag,
} from "@/lib/cache-tags";
import { PUBLIC_POST_SELECT_LIMIT, PUBLIC_SEARCH_QUERY_MAX } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createPublicCachedQuery } from "@/lib/public-cache";
import { decodeRouteSegment, plainTextFromMarkdown, toSlug } from "@/lib/text";

export const postInclude = {
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
  _count: {
    select: {
      comments: { where: { status: "APPROVED" as const } },
    },
  },
} as const;

const SEARCH_RESULTS_LIMIT = 24;
const SEARCH_CANDIDATE_LIMIT = 240;
export const SEARCH_PAGE_SIZE = 12;
export const ARCHIVE_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;
const RELATED_CANDIDATE_LIMIT = 36;
const RELATED_POST_LIMIT = 3;
const RELATED_CATEGORY_SCORE = 2;
const RELATED_TAG_SCORE = 3;
const SEARCH_TOKEN_PATTERN = /[A-Za-z0-9.+#-]+|[\u4e00-\u9fa5]+/g;
const MIN_SEARCH_TOKEN_LENGTH = 1;
const TITLE_EXACT_SCORE = 120;
const TITLE_TOKEN_SCORE = 36;
const SLUG_SCORE = 28;
const CATEGORY_SCORE = 22;
const TAG_SCORE = 18;
const EXCERPT_SCORE = 14;
const CONTENT_SCORE = 8;
const RECENCY_SCORE = 6;
const SNIPPET_RADIUS = 52;
const MAX_MATCHED_TAGS = 3;
const MAX_SEARCH_TOKENS = 10;
const MAX_PUBLIC_SLUG_LENGTH = 140;
const MAX_PUBLIC_POST_ID_LENGTH = 64;
const PUBLIC_SLUG_PATTERN = /^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u;
const PUBLIC_POST_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

async function queryPublishedPosts() {
  return prisma.post.findMany({
    where: { status: "PUBLISHED" },
    include: postInclude,
    orderBy: createPublishedPostOrder("desc"),
    take: PUBLIC_POST_SELECT_LIMIT,
  });
}

async function queryPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      ...postInclude,
      comments: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: {
          author: true,
          body: true,
          createdAt: true,
          id: true,
          parentId: true,
        },
      },
    },
  });
}

async function queryPublishedPostNavigation(currentPostId: string) {
  const current = await prisma.post.findFirst({
    where: { id: currentPostId, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!current) {
    return { next: null, previous: null };
  }

  const select = {
    excerpt: true,
    id: true,
    publishedAt: true,
    slug: true,
    title: true,
  } as const;
  const [previousPosts, nextPosts] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      cursor: { id: current.id },
      orderBy: createPublishedPostOrder("desc"),
      select,
      skip: 1,
      take: 1,
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      cursor: { id: current.id },
      orderBy: createPublishedPostOrder("asc"),
      select,
      skip: 1,
      take: 1,
    }),
  ]);

  return {
    next: nextPosts[0] ?? null,
    previous: previousPosts[0] ?? null,
  };
}

async function queryPublishedPostArchivePage(options: {
  readonly cursor?: string;
  readonly pageSize?: number;
} = {}) {
  const cursor = options.cursor?.trim();
  const pageSize = validatePageSize(options.pageSize ?? ARCHIVE_PAGE_SIZE);

  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    include: postInclude,
    orderBy: createPublishedPostOrder("desc"),
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasNextPage = posts.length > pageSize;
  const items = hasNextPage ? posts.slice(0, pageSize) : posts;

  return {
    hasNextPage,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
    posts: items,
  };
}

async function queryRelatedPublishedPosts(options: {
  readonly categoryId: string | null;
  readonly postId: string;
  readonly tagIds: readonly string[];
}) {
  const tagIds = Array.from(new Set(options.tagIds));
  const relationClauses = [
    options.categoryId ? { categoryId: options.categoryId } : null,
    tagIds.length > 0 ? { tags: { some: { tagId: { in: tagIds } } } } : null,
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

  if (relationClauses.length === 0) {
    return [];
  }

  const candidates = await prisma.post.findMany({
    where: {
      id: { not: options.postId },
      status: "PUBLISHED",
      OR: relationClauses,
    },
    include: postInclude,
    orderBy: createPublishedPostOrder("desc"),
    take: RELATED_CANDIDATE_LIMIT,
  });

  return candidates
    .map((post) => createRelatedPost(post, options.categoryId, tagIds))
    .sort(compareRelatedPosts)
    .slice(0, RELATED_POST_LIMIT);
}

async function queryPublishedPostSitemapEntries() {
  return prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: createPublishedPostOrder("desc"),
    select: {
      category: { select: { slug: true } },
      slug: true,
      tags: { select: { tag: { select: { slug: true } } } },
      updatedAt: true,
    },
  });
}

async function queryPublishedPostsForFeed(limit = SEARCH_RESULTS_LIMIT) {
  return prisma.post.findMany({
    where: { status: "PUBLISHED" },
    include: postInclude,
    orderBy: createPublishedPostOrder("desc"),
    take: validatePageSize(limit),
  });
}

async function queryCategoriesWithCounts() {
  return prisma.category.findMany({
    where: { posts: { some: { status: "PUBLISHED" } } },
    include: {
      _count: {
        select: {
          posts: { where: { status: "PUBLISHED" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

async function queryTagsWithCounts() {
  return prisma.tag.findMany({
    where: {
      posts: {
        some: {
          post: {
            status: "PUBLISHED",
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          posts: { where: { post: { status: "PUBLISHED" } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

async function queryPublishedRouteIndex() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: {
      category: { select: { slug: true } },
      id: true,
      slug: true,
      tags: { select: { tag: { select: { slug: true } } } },
    },
  });

  return {
    categorySlugs: Array.from(new Set(posts.flatMap((post) => post.category?.slug ?? []))).sort(),
    postIds: posts.map((post) => post.id).sort(),
    postSlugs: posts.map((post) => post.slug).sort(),
    tagSlugs: Array.from(new Set(posts.flatMap((post) => post.tags.map(({ tag }) => tag.slug)))).sort(),
  };
}

async function querySearchPublishedPosts(query: string) {
  const page = await querySearchPublishedPostsPage(query, { pageSize: SEARCH_RESULTS_LIMIT });
  return page.posts;
}

async function querySearchPublishedPostsPage(
  query: string,
  options: { readonly page?: number; readonly pageSize?: number } = {},
) {
  const keyword = query.trim();
  const page = validatePageNumber(options.page ?? 1);
  const pageSize = validatePageSize(options.pageSize ?? SEARCH_PAGE_SIZE);

  if (keyword.length > PUBLIC_SEARCH_QUERY_MAX) {
    throw new RangeError(`Search query must not exceed ${PUBLIC_SEARCH_QUERY_MAX} characters.`);
  }

  if (!keyword) {
    return createEmptySearchPage(page, pageSize);
  }

  const tokens = createSearchTokens(keyword);
  const candidates = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      OR: createSearchClauses(tokens),
    },
    include: postInclude,
    orderBy: createPublishedPostOrder("desc"),
    take: SEARCH_CANDIDATE_LIMIT + 1,
  });
  const isCandidateLimitReached = candidates.length > SEARCH_CANDIDATE_LIMIT;
  const rankedPosts = candidates
    .slice(0, SEARCH_CANDIDATE_LIMIT)
    .map((post) => createSearchResult(post, tokens))
    .filter((post) => post.search.score > 0)
    .sort(compareSearchResults);
  const total = rankedPosts.length;
  const pageCount = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;

  return {
    isCandidateLimitReached,
    page,
    pageCount,
    pageSize,
    posts: rankedPosts.slice(start, start + pageSize),
    total,
  };
}

async function queryCategoryWithPublishedPosts(slug: string) {
  return prisma.category.findFirst({
    where: { slug, posts: { some: { status: "PUBLISHED" } } },
    include: {
      posts: {
        where: { status: "PUBLISHED" },
        include: postInclude,
        orderBy: createPublishedPostOrder("desc"),
      },
    },
  });
}

async function queryTagWithPublishedPosts(slug: string) {
  return prisma.tag.findFirst({
    where: { slug, posts: { some: { post: { status: "PUBLISHED" } } } },
    include: {
      posts: {
        where: { post: { status: "PUBLISHED" } },
        include: { post: { include: postInclude } },
      },
    },
  });
}

const getCachedPublishedPosts = createPublicCachedQuery(
  queryPublishedPosts,
  ["prelog:query:published-posts:v1"],
  [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, TAGS_CACHE_TAG],
);
const getCachedPublishedPostNavigation = createPublicCachedQuery(
  queryPublishedPostNavigation,
  ["prelog:query:published-post-navigation:v1"],
  [POSTS_CACHE_TAG],
);
const getCachedPublishedPostArchivePage = createPublicCachedQuery(
  queryPublishedPostArchivePage,
  ["prelog:query:published-post-archive:v1"],
  [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, TAGS_CACHE_TAG],
);
const getCachedRelatedPublishedPosts = createPublicCachedQuery(
  queryRelatedPublishedPosts,
  ["prelog:query:related-published-posts:v1"],
  [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, TAGS_CACHE_TAG],
);
const getCachedPublishedPostSitemapEntries = createPublicCachedQuery(
  queryPublishedPostSitemapEntries,
  ["prelog:query:published-post-sitemap:v1"],
  [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, TAGS_CACHE_TAG],
);
const getCachedPublishedPostsForFeed = createPublicCachedQuery(
  queryPublishedPostsForFeed,
  ["prelog:query:published-post-feed:v1"],
  [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, TAGS_CACHE_TAG],
);
const getCachedCategoriesWithCounts = createPublicCachedQuery(
  queryCategoriesWithCounts,
  ["prelog:query:categories-with-counts:v1"],
  [CATEGORIES_CACHE_TAG, POSTS_CACHE_TAG],
);
const getCachedTagsWithCounts = createPublicCachedQuery(
  queryTagsWithCounts,
  ["prelog:query:tags-with-counts:v1"],
  [TAGS_CACHE_TAG, POSTS_CACHE_TAG],
);
const getCachedPublishedRouteIndex = createPublicCachedQuery(
  queryPublishedRouteIndex,
  ["prelog:query:published-route-index:v1"],
  [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, TAGS_CACHE_TAG],
);
const getPublishedRouteIndex = cache(async () => {
  const index = await getCachedPublishedRouteIndex();
  return {
    categorySlugs: new Set(index.categorySlugs),
    postIds: new Set(index.postIds),
    postSlugs: new Set(index.postSlugs),
    tagSlugs: new Set(index.tagSlugs),
  };
});
export const getPublishedPosts = cache(getCachedPublishedPosts);
export const getPublishedPostNavigation = cache(getCachedPublishedPostNavigation);
export const getRelatedPublishedPosts = cache(getCachedRelatedPublishedPosts);
export const getPublishedPostSitemapEntries = cache(getCachedPublishedPostSitemapEntries);
export const getPublishedPostsForFeed = cache(getCachedPublishedPostsForFeed);
export const getCategoriesWithCounts = cache(getCachedCategoriesWithCounts);
export const getTagsWithCounts = cache(getCachedTagsWithCounts);
export const searchPublishedPosts = cache(querySearchPublishedPosts);
export const searchPublishedPostsPage = cache(querySearchPublishedPostsPage);

export const getPublishedPostArchivePage = cache(async (options: {
  readonly cursor?: string;
  readonly pageSize?: number;
} = {}) => {
  const cursor = options.cursor?.trim();
  validatePageSize(options.pageSize ?? ARCHIVE_PAGE_SIZE);

  if (cursor) {
    const index = await getPublishedRouteIndex();

    if (!isPossiblePublicPostId(cursor) || !index.postIds.has(cursor)) {
      return null;
    }
  }

  return getCachedPublishedPostArchivePage({ ...options, cursor });
});

export const getPublishedPostBySlug = cache(async (slug: string) => {
  const decodedSlug = normalizePublicSlug(slug);

  if (!decodedSlug || !(await getPublishedRouteIndex()).postSlugs.has(decodedSlug)) {
    return null;
  }

  return createPublicCachedQuery(
    queryPublishedPostBySlug,
    ["prelog:query:published-post-by-slug:v1", decodedSlug],
    [POSTS_CACHE_TAG, createPostCacheTag(decodedSlug)],
  )(decodedSlug);
});

export const getCategoryWithPublishedPosts = cache(async (slug: string) => {
  const decodedSlug = normalizePublicSlug(slug);

  if (!decodedSlug || !(await getPublishedRouteIndex()).categorySlugs.has(decodedSlug)) {
    return null;
  }

  return createPublicCachedQuery(
    queryCategoryWithPublishedPosts,
    ["prelog:query:category-with-published-posts:v1", decodedSlug],
    [POSTS_CACHE_TAG, CATEGORIES_CACHE_TAG, createCategoryCacheTag(decodedSlug)],
  )(decodedSlug);
});

export const getTagWithPublishedPosts = cache(async (slug: string) => {
  const decodedSlug = normalizePublicSlug(slug);

  if (!decodedSlug || !(await getPublishedRouteIndex()).tagSlugs.has(decodedSlug)) {
    return null;
  }

  return createPublicCachedQuery(
    queryTagWithPublishedPosts,
    ["prelog:query:tag-with-published-posts:v1", decodedSlug],
    [POSTS_CACHE_TAG, TAGS_CACHE_TAG, createTagCacheTag(decodedSlug)],
  )(decodedSlug);
});

function normalizePublicSlug(segment: string) {
  try {
    const slug = decodeRouteSegment(segment).trim();

    if (slug.length === 0 || slug.length > MAX_PUBLIC_SLUG_LENGTH || !PUBLIC_SLUG_PATTERN.test(slug)) {
      return null;
    }

    return slug;
  } catch {
    return null;
  }
}

function isPossiblePublicPostId(value: string) {
  return value.length <= MAX_PUBLIC_POST_ID_LENGTH && PUBLIC_POST_ID_PATTERN.test(value);
}

function createSearchTokens(query: string) {
  const source = query.trim();
  const latinTokens = source.toLowerCase().match(SEARCH_TOKEN_PATTERN) ?? [];
  const slugToken = toSlug(source);
  return uniqueTokens([source.toLowerCase(), slugToken, ...latinTokens]).slice(0, MAX_SEARCH_TOKENS);
}

function uniqueTokens(tokens: readonly string[]) {
  return Array.from(
    new Set(tokens.map((token) => token.trim().toLowerCase()).filter((token) => token.length >= MIN_SEARCH_TOKEN_LENGTH)),
  );
}

function createSearchClauses(tokens: readonly string[]) {
  return tokens.flatMap((token) => [
    { title: { contains: token, mode: "insensitive" as const } },
    { slug: { contains: token, mode: "insensitive" as const } },
    { excerpt: { contains: token, mode: "insensitive" as const } },
    { content: { contains: token, mode: "insensitive" as const } },
    { category: { is: { name: { contains: token, mode: "insensitive" as const } } } },
    { tags: { some: { tag: { name: { contains: token, mode: "insensitive" as const } } } } },
  ]);
}

function createSearchResult(
  post: Awaited<ReturnType<typeof getPublishedPosts>>[number],
  tokens: readonly string[],
) {
  const title = post.title.toLowerCase();
  const slug = post.slug.toLowerCase();
  const excerpt = post.excerpt.toLowerCase();
  const content = plainTextFromMarkdown(post.content).toLowerCase();
  const category = post.category?.name.toLowerCase() ?? "";
  const tagNames = post.tags.map(({ tag }) => tag.name);
  const matchedTags = tagNames.filter((tag) => containsAnyToken(tag, tokens)).slice(0, MAX_MATCHED_TAGS);
  const titleExact = tokens.some((token) => title.includes(token));
  const score = getSearchScore({ category, content, excerpt, matchedTags, post, slug, title, tokens, titleExact });

  return {
    ...post,
    search: {
      matchedCategory: Boolean(post.category && containsAnyToken(post.category.name, tokens)),
      matchedTags,
      score,
      snippet: createSearchSnippet(post, tokens),
      titleExact,
    },
  };
}

function getSearchScore(options: {
  readonly category: string;
  readonly content: string;
  readonly excerpt: string;
  readonly matchedTags: readonly string[];
  readonly post: { readonly publishedAt: Date | null };
  readonly slug: string;
  readonly title: string;
  readonly titleExact: boolean;
  readonly tokens: readonly string[];
}) {
  let score = 0;

  if (options.titleExact) {
    score += TITLE_EXACT_SCORE;
  }

  score += countMatchedTokens(options.title, options.tokens) * TITLE_TOKEN_SCORE;
  score += countMatchedTokens(options.slug, options.tokens) * SLUG_SCORE;
  score += countMatchedTokens(options.category, options.tokens) * CATEGORY_SCORE;
  score += options.matchedTags.length * TAG_SCORE;
  score += countMatchedTokens(options.excerpt, options.tokens) * EXCERPT_SCORE;
  score += countMatchedTokens(options.content, options.tokens) * CONTENT_SCORE;

  if (options.post.publishedAt) {
    score += RECENCY_SCORE;
  }

  return score;
}

function countMatchedTokens(source: string, tokens: readonly string[]) {
  return tokens.reduce((count, token) => count + (source.includes(token.toLowerCase()) ? 1 : 0), 0);
}

function containsAnyToken(source: string, tokens: readonly string[]) {
  return countMatchedTokens(source.toLowerCase(), tokens) > 0;
}

function createSearchSnippet(post: { readonly content: string; readonly excerpt: string }, tokens: readonly string[]) {
  const excerpt = post.excerpt.trim();

  if (containsAnyToken(excerpt, tokens)) {
    return excerpt;
  }

  const text = plainTextFromMarkdown(post.content);
  const snippet = getSnippetAroundMatch(text, tokens);
  return snippet || excerpt;
}

function getSnippetAroundMatch(source: string, tokens: readonly string[]) {
  const lowerSource = source.toLowerCase();
  const matchIndex = tokens
    .map((token) => lowerSource.indexOf(token.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (matchIndex === undefined) {
    return "";
  }

  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(source.length, matchIndex + SNIPPET_RADIUS);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function createPublishedPostOrder(direction: "asc" | "desc"): Prisma.PostOrderByWithRelationInput[] {
  return [{ publishedAt: direction }, { createdAt: direction }, { id: direction }];
}

function validatePageNumber(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("Page number must be a positive safe integer.");
  }

  return value;
}

function validatePageSize(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new RangeError(`Page size must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  return value;
}

function createEmptySearchPage(page: number, pageSize: number) {
  return {
    isCandidateLimitReached: false,
    page,
    pageCount: 0,
    pageSize,
    posts: [],
    total: 0,
  };
}

function compareSearchResults(
  left: ReturnType<typeof createSearchResult>,
  right: ReturnType<typeof createSearchResult>,
) {
  if (right.search.score !== left.search.score) {
    return right.search.score - left.search.score;
  }

  const rightTime = (right.publishedAt ?? right.createdAt).getTime();
  const leftTime = (left.publishedAt ?? left.createdAt).getTime();
  return rightTime - leftTime || right.id.localeCompare(left.id);
}

function createRelatedPost(
  post: Awaited<ReturnType<typeof getPublishedPosts>>[number],
  categoryId: string | null,
  tagIds: readonly string[],
) {
  const sharedTags = post.tags.filter(({ tag }) => tagIds.includes(tag.id)).map(({ tag }) => tag);
  const sharedCategory = Boolean(categoryId && post.categoryId === categoryId);

  return {
    post,
    relevance: {
      score: sharedTags.length * RELATED_TAG_SCORE + (sharedCategory ? RELATED_CATEGORY_SCORE : 0),
      sharedCategory,
      sharedTags,
    },
  };
}

function compareRelatedPosts(
  left: ReturnType<typeof createRelatedPost>,
  right: ReturnType<typeof createRelatedPost>,
) {
  if (right.relevance.score !== left.relevance.score) {
    return right.relevance.score - left.relevance.score;
  }

  const rightTime = (right.post.publishedAt ?? right.post.createdAt).getTime();
  const leftTime = (left.post.publishedAt ?? left.post.createdAt).getTime();
  return rightTime - leftTime || right.post.id.localeCompare(left.post.id);
}
