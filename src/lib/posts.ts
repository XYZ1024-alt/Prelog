import { PUBLIC_POST_SELECT_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
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
      comments: true,
    },
  },
} as const;

const SEARCH_RESULTS_LIMIT = 24;
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

export async function getPublishedPosts() {
  return prisma.post.findMany({
    where: { status: "PUBLISHED" },
    include: postInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: PUBLIC_POST_SELECT_LIMIT,
  });
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug: decodeRouteSegment(slug), status: "PUBLISHED" },
    include: {
      ...postInclude,
      comments: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getPublishedPostNavigation(currentPostId: string) {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      createdAt: true,
      excerpt: true,
      id: true,
      publishedAt: true,
      slug: true,
      title: true,
    },
  });
  const currentIndex = posts.findIndex((post) => post.id === currentPostId);

  if (currentIndex === -1) {
    return { next: null, previous: null };
  }

  return {
    next: posts[currentIndex - 1] ?? null,
    previous: posts[currentIndex + 1] ?? null,
  };
}

export async function getCategoriesWithCounts() {
  return prisma.category.findMany({
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

export async function getTagsWithCounts() {
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

export async function searchPublishedPosts(query: string) {
  const keyword = query.trim();

  if (!keyword) {
    return [];
  }

  const tokens = createSearchTokens(keyword);
  const candidates = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      OR: createSearchClauses(tokens),
    },
    include: postInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: SEARCH_RESULTS_LIMIT,
  });

  return candidates
    .map((post) => createSearchResult(post, tokens))
    .filter((post) => post.search.score > 0)
    .sort((left, right) => {
      if (right.search.score !== left.search.score) {
        return right.search.score - left.search.score;
      }

      const rightTime = (right.publishedAt ?? right.createdAt).getTime();
      const leftTime = (left.publishedAt ?? left.createdAt).getTime();
      return rightTime - leftTime;
    });
}

function createSearchTokens(query: string) {
  const source = query.trim();
  const latinTokens = source.toLowerCase().match(SEARCH_TOKEN_PATTERN) ?? [];
  const slugToken = toSlug(source);
  return uniqueTokens([source.toLowerCase(), slugToken, ...latinTokens]);
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
