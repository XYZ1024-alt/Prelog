import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FolderTree, Hash, Layers, Sparkles } from "lucide-react";

import { AnimatedPage } from "@/components/animated-page";
import { PostCard } from "@/components/post-card";
import { TypographicAscii } from "@/components/typographic-ascii";
import { getCategoriesWithCounts, getPublishedPosts, getTagsWithCounts } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const DEFAULT_KEYWORDS = ["Web", "AI 工具", "产品思考", "项目实践", "设计细节"];
const TAXONOMY_LIMIT = 8;

type HeroPost = {
  readonly excerpt: string;
  readonly readingMinutes: number;
  readonly slug: string;
  readonly title: string;
};

type TaxonomyItem = readonly [string, string, number];

export default async function HomePage() {
  const [posts, categories, tags, settings] = await Promise.all([
    getPublishedPosts(),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
    getSiteSettings(),
  ]);
  const leadPost = posts[0];
  const categoryItems = categories.map((item) => [item.name, item.slug, item._count.posts] as const);
  const tagItems = tags.map((item) => [item.name, item.slug, item._count.posts] as const);

  return (
    <AnimatedPage>
      <HeroSection
        excerpt={settings.heroExcerpt}
        leadPost={leadPost}
        posts={posts.slice(0, 3)}
        tags={tags.slice(0, 5).map((tag) => tag.name)}
        title={settings.heroTitle}
      />
      <section className="home-content-grid">
        <LatestPosts posts={posts} />
        <TaxonomySidebar categories={categoryItems} tags={tagItems} />
      </section>
    </AnimatedPage>
  );
}

function HeroSection({
  excerpt,
  leadPost,
  posts,
  tags,
  title,
}: {
  readonly excerpt: string;
  readonly leadPost: HeroPost | undefined;
  readonly posts: readonly HeroPost[];
  readonly tags: readonly string[];
  readonly title: string;
}) {
  return (
    <section className="hero hero--simple">
      <TypographicAscii text={title} />
      <div className="hero__copy">
        <span className="eyebrow">
          <Sparkles size={16} />
          Web / AI / Product Notes
        </span>
        <h1>{title}</h1>
        <p>{excerpt}</p>
        <div className="hero__actions">
          <Link className="button button--primary" href={leadPost ? `/posts/${leadPost.slug}` : "/search"}>
            阅读最新文章
            <ArrowRight size={17} />
          </Link>
          <Link className="button button--ghost" href="/search">
            浏览全部文章
          </Link>
        </div>
      </div>
      <HeroVisual posts={posts} tags={tags} />
    </section>
  );
}

function HeroVisual({ posts, tags }: { readonly posts: readonly HeroPost[]; readonly tags: readonly string[] }) {
  const keywords = tags.length > 0 ? tags : DEFAULT_KEYWORDS;

  return (
    <aside className="hero-visual" aria-label="博客内容预览">
      <div className="hero-visual__grid" />
      <div className="hero-visual__keywords">
        {keywords.map((keyword) => (
          <span key={keyword}>{keyword}</span>
        ))}
      </div>
      <div className="hero-visual__stack">
        {posts.length > 0 ? posts.map((post) => <HeroPreviewPost key={post.slug} post={post} />) : <EmptyPreview />}
      </div>
    </aside>
  );
}

function HeroPreviewPost({ post }: { readonly post: HeroPost }) {
  return (
    <Link className="hero-preview-post" href={`/posts/${post.slug}`}>
      <span>{post.readingMinutes} min read</span>
      <strong>{post.title}</strong>
      <p>{post.excerpt}</p>
    </Link>
  );
}

function EmptyPreview() {
  return (
    <div className="hero-preview-post">
      <span>Draft notes</span>
      <strong>等待第一篇文章发布</strong>
      <p>这里会展示最近文章的轻量预览，让首屏更像一个正在写作的博客。</p>
    </div>
  );
}

function LatestPosts({ posts }: { readonly posts: Awaited<ReturnType<typeof getPublishedPosts>> }) {
  return (
    <section className="home-posts">
      <div className="section-title">
        <span>
          <Layers size={17} />
          最新文章
        </span>
      </div>
      <div className="post-grid">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {posts.length === 0 ? <p className="empty-state">暂无已发布文章，请在后台创建并发布。</p> : null}
    </section>
  );
}

function TaxonomySidebar({ categories, tags }: { readonly categories: readonly TaxonomyItem[]; readonly tags: readonly TaxonomyItem[] }) {
  return (
    <aside className="home-taxonomy" aria-label="分类和标签">
      <TaxonomyPanel href="/categories" icon={<FolderTree size={16} />} items={categories} title="分类" />
      <TaxonomyPanel href="/tags" icon={<Hash size={16} />} items={tags} title="标签" />
    </aside>
  );
}

function TaxonomyPanel({
  href,
  icon,
  items,
  title,
}: {
  readonly href: string;
  readonly icon: ReactNode;
  readonly items: readonly TaxonomyItem[];
  readonly title: string;
}) {
  return (
    <section className="taxonomy-panel">
      <div className="taxonomy-panel__head">
        <h2>
          {icon}
          {title}
        </h2>
        <Link href={href}>全部</Link>
      </div>
      <div className="tag-row">
        {items.slice(0, TAXONOMY_LIMIT).map(([name, slug, count]) => (
          <Link className="tag" href={`${href}/${slug}`} key={slug}>
            {name} · {count}
          </Link>
        ))}
      </div>
    </section>
  );
}
