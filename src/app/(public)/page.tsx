import Image from "next/image";
import Link from "next/link";
import { Archive, ArrowRight, ArrowUpRight, Search } from "lucide-react";

import { ArticleGlyph } from "@/components/article-glyph";
import { GlyphHero } from "@/components/glyph-hero";
import { PageShell } from "@/components/page-shell";
import { resolvePostCover } from "@/lib/post-cover";
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
    <PageShell className="glyph-index-page">
      <HomeHero
        description={settings.heroExcerpt}
        postCount={posts.length}
        siteName={settings.siteName}
        statement={settings.heroTitle}
      />
      <FeaturedPost post={posts[0]} />
      <WritingIndex
        categoryCount={categories.length}
        posts={posts.slice(1)}
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
    <section className="glyph-home-hero">
      <div className="glyph-home-hero__copy">
        <span className="index-kicker">独立写作 / 技术与产品 / {formatCount(postCount)} 篇</span>
        <h1>{siteName}</h1>
        <h2>{statement}</h2>
        <p>{description}</p>
      </div>
      <GlyphHero />
    </section>
  );
}

function FeaturedPost({ post }: { readonly post: PublishedPost | undefined }) {
  if (!post) {
    return (
      <section aria-labelledby="latest-post-heading" className="home-featured home-featured--empty">
        <h2 id="latest-post-heading">最新文章</h2>
        <strong>第一篇文章正在编辑</strong>
      </section>
    );
  }

  const cover = resolvePostCover(post);

  return (
    <section aria-labelledby="latest-post-heading" className="home-featured">
      <header className="home-featured__header">
        <h2 id="latest-post-heading">最新文章</h2>
        <Link href="/archive">查看全部文章</Link>
      </header>
      <article className="home-featured__entry">
        <Link aria-label={`阅读 ${post.title}`} className="home-featured__media" href={`/posts/${post.slug}`}>
          {cover.mode === "MANUAL" ? (
            <Image
              alt=""
              className="home-featured__image"
              fill
              referrerPolicy="no-referrer"
              sizes="(max-width: 720px) 100vw, 320px"
              src={cover.imageUrl}
              unoptimized
            />
          ) : (
            <ArticleGlyph preset="thumbnail" recipe={cover.recipe} />
          )}
        </Link>
        <div className="home-featured__copy">
          <div className="home-featured__meta">
            <time dateTime={post.publishedAt?.toISOString()}>{formatDate(post.publishedAt)}</time>
            {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : null}
            <span>{post.readingMinutes} 分钟</span>
          </div>
          <h3>
            <Link href={`/posts/${post.slug}`}>{post.title}</Link>
          </h3>
          <p>{post.excerpt}</p>
          <div className="home-featured__foot">
            <div className="home-featured__tags">
              {post.tags.map(({ tag }) => (
                <Link href={`/tags/${tag.slug}`} key={tag.slug}>#{tag.name}</Link>
              ))}
            </div>
            <Link aria-label={`阅读 ${post.title}`} className="home-featured__arrow" href={`/posts/${post.slug}`}>
              <ArrowRight size={19} />
            </Link>
          </div>
        </div>
      </article>
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
        <h2 id="writing-index-title">文章索引</h2>
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
          {posts.map((post) => (
            <IndexEntry key={post.id} post={post} />
          ))}
        </ol>
      ) : (
        <p className="index-empty">更多文章正在整理。</p>
      )}
    </section>
  );
}

function IndexEntry({ post }: { readonly post: PublishedPost }) {
  const cover = resolvePostCover(post);

  return (
    <li className="index-entry">
      <div className="index-entry__glyph">
        {cover.mode === "MANUAL" ? (
          <Image
            alt=""
            className="index-entry__image"
            fill
            referrerPolicy="no-referrer"
            sizes="(max-width: 620px) 88px, (max-width: 960px) 150px, 180px"
            src={cover.imageUrl}
            unoptimized
          />
        ) : (
          <ArticleGlyph preset="thumbnail" recipe={cover.recipe} />
        )}
      </div>
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
