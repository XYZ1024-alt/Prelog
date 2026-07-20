import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MessageCircle, Timer } from "lucide-react";

import { ArticleGlyph } from "@/components/article-glyph";
import { ArticleGlyphUpgrade } from "@/components/article-glyph-upgrade";
import { getGlyphRecipeInitial, type GlyphRecipe } from "@/lib/glyph-recipe";
import type { ResolvedPostCover } from "@/lib/post-cover";

type ArticleTaxonomy = {
  readonly name: string;
  readonly slug: string;
};

type ArticleHeroProps = {
  readonly category: ArticleTaxonomy | null;
  readonly commentCount: number;
  readonly cover: ResolvedPostCover;
  readonly excerpt: string;
  readonly publishedAt: Date | null;
  readonly readingMinutes: number;
  readonly tags: readonly ArticleTaxonomy[];
  readonly title: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function ArticleHero({
  category,
  commentCount,
  cover,
  excerpt,
  publishedAt,
  readingMinutes,
  tags,
  title,
}: ArticleHeroProps) {
  return (
    <header className="article-hero">
      <div className="article-hero__copy">
        <div className="article-hero__kicker">
          {category ? <Link href={`/categories/${category.slug}`}>{category.name}</Link> : <span>未分类</span>}
          <span>写作记录</span>
        </div>
        <h1>{title}</h1>
        <p>{excerpt}</p>
        <div className="article-meta">
          <time dateTime={publishedAt?.toISOString()}>
            <CalendarDays size={15} />
            {publishedAt ? DATE_FORMATTER.format(publishedAt) : "日期未注明"}
          </time>
          <span>
            <Timer size={15} />
            {readingMinutes} 分钟
          </span>
          <span>
            <MessageCircle size={15} />
            {commentCount} 条评论
          </span>
        </div>
        <div className="article-hero__tags">
          {tags.map((tag) => (
            <Link href={`/tags/${tag.slug}`} key={tag.slug}>
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
      <figure className="article-hero__visual">
        <div className={`article-hero__visual-frame article-hero__visual-frame--${cover.mode.toLowerCase()}`}>
          {cover.mode === "MANUAL" ? (
            <Image
              alt={title}
              fill
              preload
              referrerPolicy="no-referrer"
              sizes="(max-width: 760px) 100vw, 42vw"
              src={cover.imageUrl}
              unoptimized
            />
          ) : (
            <>
              <ArticleGlyph preset="feature" recipe={cover.recipe} />
              <ArticleGlyphUpgrade recipe={cover.recipe} />
            </>
          )}
        </div>
        <figcaption>
          <span>{cover.mode === "MANUAL" ? "封面 / 原图" : formatGlyphLegend(cover.recipe)}</span>
          <span>{publishedAt ? DATE_FORMATTER.format(publishedAt) : "日期未注明"}</span>
        </figcaption>
      </figure>
    </header>
  );
}

function formatGlyphLegend(recipe: GlyphRecipe) {
  const initial = getGlyphRecipeInitial(recipe) ?? "旧版";
  return `首字 ${initial} / 章节 ${padCount(recipe.legend.sections)} / 代码 ${padCount(recipe.legend.codeBlocks)}`;
}

function padCount(value: number) {
  return String(value).padStart(2, "0");
}
