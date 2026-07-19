import Link from "next/link";
import { Archive, ArrowUpRight, Search } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { getCategoriesWithCounts, getPublishedPosts, getTagsWithCounts } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";

type PublishedPost = Awaited<ReturnType<typeof getPublishedPosts>>[number];

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function HomePage() {
  const [posts, categories, tags, settings] = await Promise.all([
    getPublishedPosts(),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
    getSiteSettings(),
  ]);

  return (
    <PageShell className="home-page">
      <HomeHero
        description={settings.heroExcerpt}
        postCount={posts.length}
        siteName={settings.siteName}
        statement={settings.heroTitle}
      />
      <WritingIndex
        categoryCount={categories.length}
        posts={posts}
        tagCount={tags.length}
        totalPostCount={posts.length}
      />
    </PageShell>
  );
}

function HomeHero({
  description,
  postCount,
  siteName,
  statement,
}: {
  readonly description: string;
  readonly postCount: number;
  readonly siteName: string;
  readonly statement: string;
}) {
  return (
    <section className="home-hero">
      <span className="index-kicker">独立写作 / 技术与产品 / {formatCount(postCount)} 篇</span>
      <h1>{siteName}</h1>
      <p className="home-hero__statement">{statement}</p>
      <p className="home-hero__description">{description}</p>
    </section>
  );
}

function WritingIndex({
  categoryCount,
  posts,
  tagCount,
  totalPostCount,
}: {
  readonly categoryCount: number;
  readonly posts: readonly PublishedPost[];
  readonly tagCount: number;
  readonly totalPostCount: number;
}) {
  return (
    <section aria-labelledby="writing-index-title" className="writing-index" id="writing-index">
      <header className="writing-index__header">
        <h2 id="writing-index-title">全部文章</h2>
        <nav aria-label="内容导航" className="writing-index__nav">
          <Link href="/archive">
            <Archive aria-hidden="true" size={15} />
            全部归档 {formatCount(totalPostCount)}
          </Link>
          <Link href="/categories">分类 {formatCount(categoryCount)}</Link>
          <Link href="/tags">标签 {formatCount(tagCount)}</Link>
          <Link href="/search">
            <Search size={15} />
            搜索
          </Link>
        </nav>
      </header>
      {posts.length > 0 ? (
        <ol className="index-list">
          {posts.map((post, index) => (
            <IndexEntry index={index + 1} key={post.id} post={post} />
          ))}
        </ol>
      ) : (
        <p className="index-empty">文章正在整理。</p>
      )}
    </section>
  );
}

function IndexEntry({ index, post }: { readonly index: number; readonly post: PublishedPost }) {
  return (
    <li className="index-entry">
      <span className="index-entry__number" aria-hidden="true">{formatCount(index)}</span>
      <div className="index-entry__copy">
        <div className="index-entry__meta">
          <time dateTime={post.publishedAt?.toISOString()}>{formatDate(post.publishedAt)}</time>
          {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : null}
          <span>{post.readingMinutes} 分钟</span>
        </div>
        <h3>
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h3>
        <p>{post.excerpt}</p>
        <div className="index-entry__tags">
          {post.tags.map(({ tag }) => (
            <Link href={`/tags/${tag.slug}`} key={tag.slug}>#{tag.name}</Link>
          ))}
        </div>
      </div>
      <Link aria-label={`阅读 ${post.title}`} className="index-entry__arrow" href={`/posts/${post.slug}`}>
        <ArrowUpRight size={21} />
      </Link>
    </li>
  );
}

function formatDate(date: Date | null) {
  return date ? DATE_FORMATTER.format(date) : "日期未注明";
}

function formatCount(value: number) {
  return String(value).padStart(2, "0");
}
