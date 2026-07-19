import Link from "next/link";
import { CalendarDays, MessageCircle, Timer } from "lucide-react";

type ArticleTaxonomy = {
  readonly name: string;
  readonly slug: string;
};

type ArticleHeroProps = {
  readonly category: ArticleTaxonomy | null;
  readonly commentCount: number;
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
    </header>
  );
}
