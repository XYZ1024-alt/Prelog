import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Timer } from "lucide-react";

import { CommentsSection, type CommentNode } from "@/app/posts/[slug]/comments-section";
import { ArticleToc } from "@/components/article-toc";
import { DynamicArticleLayout } from "@/components/dynamic-article-layout";
import { getMarkdownHeadings } from "@/lib/markdown-headings";
import { getPublishedPostBySlug, getPublishedPostNavigation } from "@/lib/posts";

export const dynamic = "force-dynamic";

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

  return {
    description: post.seoDescription ?? post.excerpt,
    title: post.seoTitle ?? post.title,
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
  const navigation = await getPublishedPostNavigation(post.id);
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
      <header className="article-hero">
        <span className="eyebrow">{post.category?.name ?? "未分类"}</span>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
        <div className="article-meta">
          <span>
            <Timer size={15} />
            {post.readingMinutes} 分钟阅读
          </span>
          <span>
            <MessageCircle size={15} />
            {post.comments.length} 条评论
          </span>
        </div>
      </header>
      <div className="article-layout">
        <div className="article-main">
          <DynamicArticleLayout content={articleContent} />
          <ArticleNavigation navigation={navigation} />
          <CommentsSection comments={commentTree} postId={post.id} slug={post.slug} />
        </div>
        <ArticleToc headings={articleHeadings} />
      </div>
    </main>
  );
}

function ArticleNavigation({ navigation }: { readonly navigation: { readonly next: NavigationPost | null; readonly previous: NavigationPost | null } }) {
  if (!navigation.previous && !navigation.next) {
    return null;
  }

  return (
    <nav aria-label="继续阅读" className="article-navigation">
      <ArticleNavigationLink label="上一篇" post={navigation.previous} />
      <ArticleNavigationLink label="下一篇" post={navigation.next} />
    </nav>
  );
}

function ArticleNavigationLink({ label, post }: { readonly label: string; readonly post: NavigationPost | null }) {
  if (!post) {
    return <span className="article-navigation__empty">{label}</span>;
  }

  return (
    <Link className="article-navigation__item" href={`/posts/${post.slug}`}>
      <span>{label}</span>
      <strong>{post.title}</strong>
      <p>{post.excerpt}</p>
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

function stripLeadingTitleHeading(content: string, title: string) {
  const normalizedTitle = normalizeHeadingText(title);
  const lines = content.split(/\r?\n/);
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex === -1) {
    return content;
  }

  return removeMatchingFirstHeading({ firstContentLineIndex, lines, normalizedTitle });
}

function removeMatchingFirstHeading(options: { readonly firstContentLineIndex: number; readonly lines: readonly string[]; readonly normalizedTitle: string }) {
  const { firstContentLineIndex, lines, normalizedTitle } = options;
  const firstLine = lines[firstContentLineIndex].trim();
  const match = /^#\s+(.+)$/.exec(firstLine);

  if (!match || normalizeHeadingText(match[1]) !== normalizedTitle) {
    return lines.join("\n");
  }

  return lines
    .slice(0, firstContentLineIndex)
    .concat(lines.slice(firstContentLineIndex + 1))
    .join("\n")
    .trimStart();
}

function normalizeHeadingText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
