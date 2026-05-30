import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Timer } from "lucide-react";

import { CommentForm } from "@/app/posts/[slug]/comment-form";
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
  readonly createdAt: Date;
  readonly id: string;
  readonly parentId: string | null;
};

type CommentNode = CommentItem & {
  readonly replies: CommentNode[];
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
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
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
  const commentTree = buildCommentTree(post.comments);

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
    <nav className="article-navigation" aria-label="继续阅读">
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

function CommentsSection({ comments, postId, slug }: { readonly comments: readonly CommentNode[]; readonly postId: string; readonly slug: string }) {
  return (
    <section className="comments">
      <h2>评论</h2>
      <p className="comments__notice">评论提交后会进入审核，通过后展示。邮箱不会公开。</p>
      <CommentForm postId={postId} slug={slug} />
      <div className="comment-list">
        {comments.map((comment) => (
          <CommentThread comment={comment} key={comment.id} postId={postId} slug={slug} />
        ))}
      </div>
      {comments.length === 0 ? <p className="empty-state">暂无评论，欢迎留下第一条想法。</p> : null}
    </section>
  );
}

function CommentThread({ comment, postId, slug }: { readonly comment: CommentNode; readonly postId: string; readonly slug: string }) {
  return (
    <article className="comment">
      <div className="comment__body">
        <div className="comment__meta">
          <strong>{comment.author}</strong>
          <time>{comment.createdAt.toLocaleString("zh-CN")}</time>
        </div>
        <p>{comment.body}</p>
      </div>
      <CommentForm parentId={comment.id} postId={postId} replyTo={comment.author} slug={slug} />
      {comment.replies.length > 0 ? (
        <div className="comment__replies">
          {comment.replies.map((reply) => (
            <CommentThread comment={reply} key={reply.id} postId={postId} slug={slug} />
          ))}
        </div>
      ) : null}
    </article>
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

function removeMatchingFirstHeading({ firstContentLineIndex, lines, normalizedTitle }: { readonly firstContentLineIndex: number; readonly lines: readonly string[]; readonly normalizedTitle: string }) {
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
