import Link from "next/link";
import { CalendarDays, MessageCircle, Timer } from "lucide-react";

import { PretextFitTitle } from "@/components/pretext-fit-title";
import type { postInclude } from "@/lib/posts";

type PostWithMeta = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  readingMinutes: number;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string; slug: string } }[];
  _count: { comments: number };
};

type CoverMeta = {
  readonly category: string;
  readonly keywords: readonly string[];
  readonly signal: string;
};

const DEFAULT_CATEGORY = "Notes";
const DEFAULT_SIGNAL = "LOG";
const MAX_KEYWORDS = 3;
const TITLE_TOKEN_PATTERN = /[A-Za-z0-9.+#-]+|[\u4e00-\u9fa5]{2,4}/g;

const SIGNAL_RULES = [
  { signal: "NEXT", terms: ["next", "react", "路由", "渲染", "部署"] },
  { signal: "TYPE", terms: ["pretext", "typography", "排版", "文字", "阅读"] },
  { signal: "UI", terms: ["ui", "design", "设计", "界面", "主题", "黑白", "留白", "网格"] },
  { signal: "AI", terms: ["ai", "agent", "模型", "提示词"] },
  { signal: "TOOL", terms: ["tool", "工具", "效率", "工作流"] },
  { signal: "LAB", terms: ["项目", "实践", "搭建", "工程"] },
] as const;

export function PostCard({ post }: { post: PostWithMeta }) {
  const date = post.publishedAt?.toLocaleDateString("zh-CN") ?? "未发布";
  const cover = createCoverMeta(post);

  return (
    <article className="post-card">
      <Link className="post-card__media" href={`/posts/${post.slug}`} aria-label={`阅读 ${post.title}`}>
        {post.coverImage ? (
          <span className="post-card__image" style={{ backgroundImage: `url(${post.coverImage})` }} />
        ) : (
          <DefaultPostCover cover={cover} />
        )}
      </Link>
      <div className="post-card__body">
        <div className="post-card__meta">
          {post.category ? <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link> : null}
          <span>
            <CalendarDays size={14} />
            {date}
          </span>
        </div>
        <PretextFitTitle href={`/posts/${post.slug}`} title={post.title} />
        <p>{post.excerpt}</p>
        <div className="post-card__foot">
          <span>
            <Timer size={14} />
            {post.readingMinutes} 分钟
          </span>
          <span>
            <MessageCircle size={14} />
            {post._count.comments}
          </span>
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

function DefaultPostCover({ cover }: { readonly cover: CoverMeta }) {
  return (
    <span className="post-card-cover">
      <span className="post-card-cover__grid" />
      <span className="post-card-cover__topline">
        <span>{cover.category}</span>
        <span>Article</span>
      </span>
      <strong>{cover.signal}</strong>
      <span className="post-card-cover__keywords">{cover.keywords.join(" / ")}</span>
      <span className="post-card-cover__marks" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

function createCoverMeta(post: PostWithMeta): CoverMeta {
  const category = post.category?.name ?? DEFAULT_CATEGORY;
  const sources = [post.title, category, ...post.tags.map(({ tag }) => tag.name)];
  const keywords = getKeywords(post, category);

  return {
    category,
    keywords,
    signal: getSignal(sources),
  };
}

function getSignal(sources: readonly string[]) {
  const source = sources.join(" ").toLowerCase();
  const matched = SIGNAL_RULES.find((rule) => rule.terms.some((term) => source.includes(term.toLowerCase())));

  if (matched) {
    return matched.signal;
  }

  return DEFAULT_SIGNAL;
}

function getKeywords(post: PostWithMeta, category: string) {
  const tagNames = post.tags.map(({ tag }) => tag.name);
  const titleTokens = post.title.match(TITLE_TOKEN_PATTERN) ?? [];
  const keywords = uniqueNonEmpty([...tagNames, category, ...titleTokens]);

  return keywords.slice(0, MAX_KEYWORDS);
}

function uniqueNonEmpty(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export type PostIncludeShape = typeof postInclude;
