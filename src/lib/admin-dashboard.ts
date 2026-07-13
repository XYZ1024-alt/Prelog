import { toAdminPath } from "@/lib/admin-path";
import type { CommentStatus, PostStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const RECENT_ACTIVITY_LIMIT = 6;
const TOP_PATH_LIMIT = 5;
const VISIT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardActivity = {
  readonly href: string;
  readonly label: string;
  readonly meta: string;
  readonly time: Date;
  readonly type: "post" | "comment";
};

export async function getAdminDashboardData() {
  const todayStart = startOfDay(new Date());
  const weekStart = addDays(todayStart, -(VISIT_DAYS - 1));
  const [postStats, commentStats, recentPosts, recentComments, totalViews, weekViews, pathViews, zeroResultQueries] = await Promise.all([
    getPostStats(),
    getCommentStats(),
    getRecentPosts(),
    getRecentComments(),
    prisma.analyticsDailyMetric.aggregate({
      _sum: { count: true },
      where: { type: "PAGE_VIEW" },
    }),
    prisma.analyticsDailyMetric.findMany({
      select: { count: true, date: true, path: true },
      where: { date: { gte: weekStart }, type: "PAGE_VIEW" },
    }),
    prisma.analyticsDailyMetric.groupBy({
      by: ["path"],
      _sum: { count: true },
      where: { type: "PAGE_VIEW" },
    }),
    prisma.analyticsDailyMetric.groupBy({
      by: ["dimension"],
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: TOP_PATH_LIMIT,
      where: { type: "SEARCH_ZERO" },
    }),
  ]);

  return {
    commentStats,
    dailyVisits: createDailyVisits(weekViews, weekStart),
    postStats,
    recentActivities: createRecentActivities(recentPosts, recentComments),
    topPaths: createTopPaths(pathViews),
    visitStats: {
      today: sumCounts(weekViews.filter((view) => view.date >= todayStart)),
      total: totalViews._sum.count ?? 0,
      week: sumCounts(weekViews),
    },
    zeroResultQueries: zeroResultQueries.map((item) => ({
      count: item._sum.count ?? 0,
      query: item.dimension,
    })),
  };
}

async function getPostStats() {
  const [total, published, draft] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
  ]);

  return { draft, published, total };
}

async function getCommentStats() {
  const [total, approved, pending, hidden, spam] = await Promise.all([
    prisma.comment.count(),
    prisma.comment.count({ where: { status: "APPROVED" } }),
    prisma.comment.count({ where: { status: "PENDING" } }),
    prisma.comment.count({ where: { status: "HIDDEN" } }),
    prisma.comment.count({ where: { status: "SPAM" } }),
  ]);

  return { approved, hidden, pending, spam, total };
}

async function getRecentPosts() {
  return prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, status: true, title: true, updatedAt: true },
    take: RECENT_ACTIVITY_LIMIT,
  });
}

async function getRecentComments() {
  return prisma.comment.findMany({
    include: { post: { select: { slug: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: RECENT_ACTIVITY_LIMIT,
  });
}

function createRecentActivities(
  posts: readonly { readonly id: string; readonly slug: string; readonly status: PostStatus; readonly title: string; readonly updatedAt: Date }[],
  comments: readonly { readonly author: string; readonly createdAt: Date; readonly post: { readonly slug: string; readonly title: string }; readonly status: CommentStatus }[],
) {
  const postActivities = posts.map((post) => ({
    href: toAdminPath(`/posts/${post.id}/edit`),
    label: post.title,
    meta: `文章 · ${post.status === "PUBLISHED" ? "已发布" : "草稿"}`,
    time: post.updatedAt,
    type: "post" as const,
  }));
  const commentActivities = comments.map((comment) => ({
    href: `/posts/${comment.post.slug}`,
    label: `${comment.author} 评论了《${comment.post.title}》`,
    meta: `评论 · ${getCommentStatusLabel(comment.status)}`,
    time: comment.createdAt,
    type: "comment" as const,
  }));

  return [...postActivities, ...commentActivities].sort((left, right) => right.time.getTime() - left.time.getTime()).slice(0, RECENT_ACTIVITY_LIMIT);
}

function getCommentStatusLabel(status: CommentStatus) {
  const labels: Record<CommentStatus, string> = {
    APPROVED: "已通过",
    HIDDEN: "已隐藏",
    PENDING: "待审核",
    SPAM: "垃圾",
  };

  return labels[status];
}

function createDailyVisits(views: readonly { readonly count: number; readonly date: Date }[], start: Date) {
  return Array.from({ length: VISIT_DAYS }, (_, index) => {
    const date = addDays(start, index);
    const count = sumCounts(views.filter((view) => view.date.getTime() === date.getTime()));
    return { count, label: formatDayLabel(date) };
  });
}

function createTopPaths(pathViews: readonly { readonly path: string; readonly _sum: { readonly count: number | null } }[]) {
  return pathViews
    .map((item) => ({ count: item._sum.count ?? 0, path: item.path }))
    .sort((left, right) => right.count - left.count)
    .slice(0, TOP_PATH_LIMIT);
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function sumCounts(items: readonly { readonly count: number }[]) {
  return items.reduce((total, item) => total + item.count, 0);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
