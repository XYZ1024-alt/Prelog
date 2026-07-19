import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

import { CommentsSection, type CommentNode } from "@/app/(public)/posts/[slug]/comments-section";
import { ArticleHero } from "@/components/article-hero";
import { ArticleToc } from "@/components/article-toc";
import { MarkdownContent } from "@/components/markdown-content";
import { getMarkdownHeadings } from "@/lib/markdown-headings";
import {
  getPublishedPostBySlug,
  getPublishedPostNavigation,
  getRelatedPublishedPosts,
} from "@/lib/posts";
import { createPageMetadataAlternates, createSiteUrl } from "@/lib/site-url";
import { createArticleDescription, stripLeadingTitleHeading } from "@/lib/text";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CommentItem = {
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
  readonly id: string;
  readonly parentId: string | null;
};

type NavigationPost = {
  readonly excerpt: string;
  readonly slug: string;
  readonly title: string;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return {};
  }

  const description = post.seoDescription ?? createArticleDescription({ excerpt: post.excerpt, title: post.title });
  const imageUrl = getPublicCoverImageUrl(post.slug);

  return {
    alternates: createPageMetadataAlternates(`/posts/${encodeURIComponent(post.slug)}`),
    description,
    openGraph: {
      description,
      images: [{ alt: post.title, url: imageUrl }],
      modifiedTime: post.updatedAt.toISOString(),
      publishedTime: post.publishedAt?.toISOString(),
      tags: post.tags.map(({ tag }) => tag.name),
      title: post.seoTitle ?? post.title,
      type: "article",
      url: createSiteUrl(`/posts/${encodeURIComponent(post.slug)}`),
    },
    title: post.seoTitle ?? post.title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [imageUrl],
      title: post.seoTitle ?? post.title,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const articleContent = stripLeadingTitleHeading(post.content, post.title);
  const articleHeadings = getMarkdownHeadings(articleContent);
  const articleDeck = createArticleDescription({ excerpt: post.excerpt, title: post.title });
  const description = post.seoDescription ?? articleDeck;
  const imageUrl = getPublicCoverImageUrl(post.slug);
  const [navigation, relatedPosts] = await Promise.all([
    getPublishedPostNavigation(post.id),
    getRelatedPublishedPosts({
      categoryId: post.categoryId,
      postId: post.id,
      tagIds: post.tags.map(({ tag }) => tag.id),
    }),
  ]);
  const articleUrl = createSiteUrl(`/posts/${encodeURIComponent(post.slug)}`);
  const structuredData = createStructuredData(post, description, imageUrl, articleUrl);
  const commentTree = buildCommentTree(
    post.comments.map((comment) => ({
      author: comment.author,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      id: comment.id,
      parentId: comment.parentId,
    })),
  );

  return (
    <main className="article-shell">
      <script
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
        type="application/ld+json"
      />
      <ArticleHero
        category={post.category}
        commentCount={post.comments.length}
        excerpt={articleDeck}
        publishedAt={post.publishedAt}
        readingMinutes={post.readingMinutes}
        tags={post.tags.map(({ tag }) => tag)}
        title={post.title}
      />
      <div className="article-layout">
        <div className="article-main">
          <MarkdownContent content={articleContent} />
          <RelatedReading items={relatedPosts} />
          <ArticleNavigation navigation={navigation} />
          <CommentsSection comments={commentTree} postId={post.id} slug={post.slug} />
        </div>
        <ArticleToc headings={articleHeadings} />
      </div>
    </main>
  );
}

type RelatedPostItem = Awaited<ReturnType<typeof getRelatedPublishedPosts>>[number];

function RelatedReading({ items }: { readonly items: readonly RelatedPostItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-reading-title" className="related-reading">
      <header>
        <h2 id="related-reading-title">继续阅读</h2>
      </header>
      <ol>
        {items.map(({ post, relevance }) => (
          <li key={post.id}>
            <div>
              <span>{createRelationLabel(post, relevance)}</span>
              <h3><Link href={`/posts/${post.slug}`}>{post.title}</Link></h3>
              <p>{post.excerpt}</p>
            </div>
            <Link aria-label={`阅读 ${post.title}`} href={`/posts/${post.slug}`}>
              <ArrowUpRight size={19} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function createRelationLabel(post: RelatedPostItem["post"], relevance: RelatedPostItem["relevance"]) {
  const signals = [
    relevance.sharedCategory && post.category ? post.category.name : null,
    ...relevance.sharedTags.map((tag) => `#${tag.name}`),
  ].filter((signal): signal is string => Boolean(signal));
  return signals.join(" / ");
}

function ArticleNavigation({ navigation }: { readonly navigation: { readonly next: NavigationPost | null; readonly previous: NavigationPost | null } }) {
  if (!navigation.previous && !navigation.next) {
    return null;
  }

  return (
    <nav aria-label="继续阅读" className="article-navigation">
      {navigation.previous ? (
        <ArticleNavigationLink direction="previous" label="上一篇" post={navigation.previous} />
      ) : null}
      {navigation.next ? <ArticleNavigationLink direction="next" label="下一篇" post={navigation.next} /> : null}
    </nav>
  );
}

function ArticleNavigationLink({
  direction,
  label,
  post,
}: {
  readonly direction: "next" | "previous";
  readonly label: string;
  readonly post: NavigationPost;
}) {
  return (
    <Link className="article-navigation__item" href={`/posts/${post.slug}`}>
      <span className="article-navigation__direction">
        {direction === "previous" ? <ArrowLeft size={18} /> : null}
        {label}
        {direction === "next" ? <ArrowRight size={18} /> : null}
      </span>
      <span className="article-navigation__copy">
        <strong>{post.title}</strong>
        <span>{post.excerpt}</span>
      </span>
    </Link>
  );
}

function buildCommentTree(comments: readonly CommentItem[]) {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => nodes.set(comment.id, { ...comment, replies: [] }));
  nodes.forEach((node) => placeCommentNode(node, nodes, roots));
  return roots;
}

function placeCommentNode(node: CommentNode, nodes: ReadonlyMap<string, CommentNode>, roots: CommentNode[]) {
  if (!node.parentId) {
    roots.push(node);
    return;
  }

  const parent = nodes.get(node.parentId);

  if (!parent) {
    roots.push(node);
    return;
  }

  parent.replies.push(node);
}

function createStructuredData(
  post: NonNullable<Awaited<ReturnType<typeof getPublishedPostBySlug>>>,
  description: string,
  imageUrl: URL,
  articleUrl: URL,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    articleSection: post.category?.name,
    dateModified: post.updatedAt.toISOString(),
    datePublished: post.publishedAt?.toISOString(),
    description,
    headline: post.seoTitle ?? post.title,
    image: imageUrl.toString(),
    keywords: post.tags.map(({ tag }) => tag.name),
    mainEntityOfPage: articleUrl.toString(),
    url: articleUrl.toString(),
  };
}

function serializeStructuredData(value: ReturnType<typeof createStructuredData>) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function getPublicCoverImageUrl(slug: string) {
  return createSiteUrl(`/api/og/posts/${encodeURIComponent(slug)}`);
}
