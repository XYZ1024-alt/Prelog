import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Hash, Search, Shapes, Sparkles } from "lucide-react";

import { ArticleGlyph } from "@/components/article-glyph";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { PUBLIC_SEARCH_QUERY_MAX } from "@/lib/constants";
import { resolvePostCover } from "@/lib/post-cover";
import { getCategoriesWithCounts, getTagsWithCounts, searchPublishedPostsPage } from "@/lib/posts";
import { createPageMetadataAlternates } from "@/lib/site-url";
import { publicSearchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: createPageMetadataAlternates("/search"),
  description: "搜索 Prelog 已发布的文章、分类与标签。",
  robots: { follow: true, index: false },
  title: "搜索",
};

const SUGGESTED_QUERIES = ["Pretext", "Next.js", "主题", "设计", "Prisma", "AI"];
const TAG_SUGGESTION_LIMIT = 8;
const CATEGORY_SUGGESTION_LIMIT = 6;

type SearchPageProps = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const formQuery = params.q?.trim() ?? "";
  const parsedQuery = publicSearchQuerySchema.safeParse(formQuery);
  const query = parsedQuery.success ? parsedQuery.data : "";
  const queryError = parsedQuery.success ? null : `搜索词最多 ${PUBLIC_SEARCH_QUERY_MAX} 个字符。`;
  const requestedPage = parsePageNumber(params.page);
  const [result, categories, tags] = await Promise.all([
    searchPublishedPostsPage(query, { page: requestedPage }),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
  ]);

  if (result.total > 0 && requestedPage > result.pageCount) {
    notFound();
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="eyebrow">
          <Search size={16} />
          Search
        </span>
        <h1>搜索文章</h1>
        <p className="page-heading__intro">支持标题、摘要、正文、分类、标签与 slug 匹配，结果会按相关性重新排序。</p>
      </section>
      <SearchForm error={queryError} query={formQuery} />
      <section className="search-shell">
        <div className="search-main">
          {query ? (
            <SearchSummary
              isCandidateLimitReached={result.isCandidateLimitReached}
              query={query}
              total={result.total}
            />
          ) : <SearchPrompt />}
          {query ? <SearchResults posts={result.posts} query={query} /> : null}
          {query ? <SearchPagination page={result.page} pageCount={result.pageCount} query={query} /> : null}
        </div>
        <aside className="search-sidebar">
          <SuggestionGroup icon={Sparkles} items={SUGGESTED_QUERIES.map((item) => ({ href: `/search?q=${encodeURIComponent(item)}`, label: item }))} title="推荐搜索" />
          <SuggestionGroup
            icon={Shapes}
            items={categories.slice(0, CATEGORY_SUGGESTION_LIMIT).map((category) => ({
              href: `/search?q=${encodeURIComponent(category.name)}`,
              label: `${category.name} · ${category._count.posts}`,
            }))}
            title="分类方向"
          />
          <SuggestionGroup
            icon={Hash}
            items={tags.slice(0, TAG_SUGGESTION_LIMIT).map((tag) => ({
              href: `/search?q=${encodeURIComponent(tag.name)}`,
              label: `#${tag.name} · ${tag._count.posts}`,
            }))}
            title="常见标签"
          />
        </aside>
      </section>
    </PageShell>
  );
}

function SearchForm({ error, query }: { readonly error: string | null; readonly query: string }) {
  return (
    <div>
      <form className="search-form search-form--wide">
        <input
          aria-label="搜索文章"
          autoComplete="off"
          defaultValue={query}
          maxLength={PUBLIC_SEARCH_QUERY_MAX}
          name="q"
          placeholder="输入标题、标签、分类或正文关键词"
          type="search"
        />
        <SubmitButton className="button button--primary" pendingChildren="搜索中...">
          搜索
        </SubmitButton>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}

function SearchPrompt() {
  return (
    <section className="search-state-card">
      <strong>从一个主题开始</strong>
      <p>可以直接搜索文章标题，也可以输入分类、标签、技术名词或你记得的一句话。</p>
    </section>
  );
}

function SearchSummary({
  isCandidateLimitReached,
  query,
  total,
}: {
  readonly isCandidateLimitReached: boolean;
  readonly query: string;
  readonly total: number;
}) {
  return (
    <section className="search-summary">
      <div>
        <span>关键词</span>
        <strong>{query}</strong>
      </div>
      <div>
        <span>结果</span>
        <strong>{isCandidateLimitReached ? `至少 ${total}` : total} 篇</strong>
      </div>
    </section>
  );
}

type SearchResultPost = Awaited<ReturnType<typeof searchPublishedPostsPage>>["posts"][number];

function SearchResults({ posts, query }: { readonly posts: readonly SearchResultPost[]; readonly query: string }) {
  if (posts.length === 0) {
    return (
      <section className="search-state-card">
        <strong>没有找到匹配结果</strong>
        <p>可以试试标题关键词、分类名、标签名，或者换成更短的技术词。</p>
      </section>
    );
  }

  return (
    <div className="search-results">
      {posts.map((post) => (
        <SearchResultCard key={post.id} post={post} query={query} />
      ))}
    </div>
  );
}

function SearchResultCard({ post, query }: { readonly post: SearchResultPost; readonly query: string }) {
  const publishedAt = post.publishedAt?.toLocaleDateString("zh-CN") ?? "未发布";
  const tokens = query.split(/\s+/).filter(Boolean);
  const cover = resolvePostCover(post);

  return (
    <article className="search-result-card">
      <Link aria-label={`阅读 ${post.title}`} className="search-result-card__cover" href={`/posts/${post.slug}`}>
        {cover.mode === "MANUAL" ? (
          <Image
            alt=""
            className="search-result-card__image"
            fill
            referrerPolicy="no-referrer"
            sizes="(max-width: 760px) 100vw, 150px"
            src={cover.imageUrl}
            unoptimized
          />
        ) : (
          <ArticleGlyph preset="thumbnail" recipe={cover.recipe} />
        )}
      </Link>
      <div className="search-result-card__copy">
        <div className="search-result-card__meta">
          {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : <span>未分类</span>}
          <span>{publishedAt}</span>
          <span>{post.readingMinutes} 分钟</span>
          <span>{post._count.comments} 评论</span>
        </div>
        <h2>
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{highlightText(post.search.snippet, tokens)}</p>
        <div className="search-result-card__signals">
          {post.search.titleExact ? <span>标题命中</span> : null}
          {post.search.matchedCategory && post.category ? <span>分类: {post.category.name}</span> : null}
          {post.search.matchedTags.map((tag) => (
            <span key={tag}>标签: {tag}</span>
          ))}
        </div>
        <div className="tag-row">
          {post.tags.map(({ tag }) => (
            <Link className="tag" href={`/tags/${tag.slug}`} key={tag.slug}>
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

function SuggestionGroup({
  icon: Icon,
  items,
  title,
}: {
  readonly icon: typeof Search;
  readonly items: readonly { readonly href: string; readonly label: string }[];
  readonly title: string;
}) {
  return (
    <section className="search-side-card">
      <strong>
        <Icon size={15} />
        {title}
      </strong>
      <div>
        {items.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SearchPagination({ page, pageCount, query }: {
  readonly page: number;
  readonly pageCount: number;
  readonly query: string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="搜索结果分页" className="content-pagination">
      {page > 1 ? (
        <Link href={createSearchPageHref(query, page - 1)}>
          <ArrowLeft size={16} />
          上一页
        </Link>
      ) : <span />}
      <span>{page} / {pageCount}</span>
      {page < pageCount ? (
        <Link href={createSearchPageHref(query, page + 1)}>
          下一页
          <ArrowRight size={16} />
        </Link>
      ) : <span />}
    </nav>
  );
}

function createSearchPageHref(query: string, page: number) {
  const params = new URLSearchParams({ q: query });
  if (page > 1) {
    params.set("page", String(page));
  }
  return `/search?${params.toString()}`;
}

function parsePageNumber(value: string | undefined) {
  if (!value) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function highlightText(text: string, tokens: readonly string[]) {
  if (tokens.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => (
    tokens.some((token) => part.toLowerCase() === token.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
