import Link from "next/link";
import { BarChart3, FileText, MessageSquare, MousePointerClick } from "lucide-react";

import { AdminNav } from "@/app/admin/admin-nav";
import { toAdminPath } from "@/lib/admin-path";
import type { DashboardActivity } from "@/lib/admin-dashboard";
import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const CHART_MAX_PERCENT = 100;

export default async function AdminIndexPage() {
  const { user } = await requireAdmin();
  const data = await getAdminDashboardData();
  const maxDailyVisits = Math.max(1, ...data.dailyVisits.map((item) => item.count));

  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>后台概览</h1>
          </div>
          <Link className="button button--primary" href={toAdminPath("/posts/new")}>
            新建文章
          </Link>
        </div>

        <section className="admin-stats-grid" aria-label="关键数据">
          <StatCard icon={FileText} label="文章数" meta={`${data.postStats.published} 已发布 · ${data.postStats.draft} 草稿`} value={data.postStats.total} />
          <StatCard icon={MessageSquare} label="评论数" meta={`${data.commentStats.pending} 待审核 · ${data.commentStats.approved} 已通过 · ${data.commentStats.hidden} 隐藏`} value={data.commentStats.total} />
          <StatCard icon={MousePointerClick} label="今日访问" meta={`${data.visitStats.week} 最近 7 天`} value={data.visitStats.today} />
          <StatCard icon={BarChart3} label="累计访问" meta="前台页面访问记录" value={data.visitStats.total} />
        </section>

        <section className="admin-dashboard-grid">
          <RecentActivities activities={data.recentActivities} />
          <VisitPanel dailyVisits={data.dailyVisits} maxDailyVisits={maxDailyVisits} topPaths={data.topPaths} />
        </section>
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>管理员账号</h2>
            <span>单管理员模式</span>
          </div>
          <div className="admin-owner-card">
            <strong>{user.name ?? "Prelog Admin"}</strong>
            <p>{user.email}</p>
            <span>后台只保留这一个管理员账号，不提供用户列表和角色分配。</span>
          </div>
        </section>
      </section>
    </main>
  );
}

type StatCardProps = {
  readonly icon: typeof FileText;
  readonly label: string;
  readonly meta: string;
  readonly value: number;
};

function StatCard({ icon: Icon, label, meta, value }: StatCardProps) {
  return (
    <article className="admin-stat-card">
      <span className="admin-stat-card__icon">
        <Icon size={18} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{meta}</p>
      </div>
    </article>
  );
}

function RecentActivities({ activities }: { readonly activities: readonly DashboardActivity[] }) {
  return (
    <section className="admin-card">
      <div className="admin-card__head">
        <h2>最近动态</h2>
        <Link href={toAdminPath("/posts")}>查看文章</Link>
      </div>
      <div className="activity-list">
        {activities.map((activity) => (
          <Link className="activity-item" href={activity.href} key={`${activity.type}-${activity.time.toISOString()}-${activity.label}`}>
            <span>{activity.type === "post" ? "文" : "评"}</span>
            <div>
              <strong>{activity.label}</strong>
              <p>
                {activity.meta} · {formatDateTime(activity.time)}
              </p>
            </div>
          </Link>
        ))}
        {activities.length === 0 ? <p className="empty-state">暂无文章或评论动态。</p> : null}
      </div>
    </section>
  );
}

type VisitPanelProps = {
  readonly dailyVisits: readonly { readonly count: number; readonly label: string }[];
  readonly maxDailyVisits: number;
  readonly topPaths: readonly { readonly count: number; readonly path: string }[];
};

function VisitPanel({ dailyVisits, maxDailyVisits, topPaths }: VisitPanelProps) {
  return (
    <section className="admin-card">
      <div className="admin-card__head">
        <h2>访问数据统计</h2>
        <span>最近 7 天</span>
      </div>
      <div className="visit-chart">
        {dailyVisits.map((day) => (
          <div className="visit-chart__bar" key={day.label}>
            <span style={{ height: `${getBarPercent(day.count, maxDailyVisits)}%` }} />
            <strong>{day.count}</strong>
            <small>{day.label}</small>
          </div>
        ))}
      </div>
      <div className="top-paths">
        <h3>热门页面</h3>
        {topPaths.map((item) => (
          <div className="top-paths__item" key={item.path}>
            <span>{item.path}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
        {topPaths.length === 0 ? <p className="empty-state">暂无访问记录。</p> : null}
      </div>
    </section>
  );
}

function getBarPercent(count: number, maxDailyVisits: number) {
  return Math.max(8, Math.round((count / maxDailyVisits) * CHART_MAX_PERCENT));
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}
