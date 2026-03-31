import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { type DashboardStats, getDashboardStats } from '@/lib/dashboard';
import { buildHistoryTaskHref } from './create/history';

export const dynamic = 'force-dynamic';

function calculateBarWidth(value: number, max: number): string {
  if (max <= 0) {
    return '0%';
  }

  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

export function HomePageContent({ stats }: { stats: DashboardStats }) {
  const maxTrackCount = Math.max(...stats.track_distribution.map((row) => row.count), 0);
  const maxContentCount = Math.max(...stats.content_type_distribution.map((row) => row.count), 0);

  return (
    <div className="pageShell">
      <header className="dashboardHeader">
        <p className="eyebrow">总览</p>
        <h1 className="dashboardHeaderTitle">总览</h1>
      </header>

      <section className="metricGrid metricGridCompact">
        <article className="metricCard">
          <p className="metricLabel">样本总量</p>
          <strong className="metricValue">{stats.overview.total_samples}</strong>
        </article>
        <article className="metricCard">
          <p className="metricLabel">近 7 天录入</p>
          <strong className="metricValue">{stats.overview.new_samples_this_week}</strong>
        </article>
        <article className="metricCard">
          <p className="metricLabel">高价值资产</p>
          <strong className="metricValue">{stats.overview.high_value_samples}</strong>
        </article>
        <article className="metricCard">
          <p className="metricLabel">风格画像</p>
          <strong className="metricValue">{stats.overview.style_profiles}</strong>
        </article>
      </section>

      <section className="twoColumnGrid dashboardGrid">
        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">资产分布</p>
              <h2 className="panelTitle">赛道热区</h2>
            </div>
          </div>

          <div className="chartStack">
            {stats.track_distribution.length > 0 ? (
              stats.track_distribution.map((row) => (
                <div className="chartRow" key={row.label}>
                  <div className="chartLabel">
                    <span>{row.label}</span>
                    <span>{row.count}</span>
                  </div>
                  <div className="chartBarTrack">
                    <div
                      className="chartBarFill"
                      style={{ width: calculateBarWidth(row.count, maxTrackCount) }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyCard">还没有赛道分布数据。</div>
            )}
          </div>
        </article>

        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">结构视角</p>
              <h2 className="panelTitle">内容类型分布</h2>
            </div>
          </div>

          <div className="chartStack">
            {stats.content_type_distribution.length > 0 ? (
              stats.content_type_distribution.map((row) => (
                <div className="chartRow" key={row.label}>
                  <div className="chartLabel">
                    <span>{row.label}</span>
                    <span>{row.count}</span>
                  </div>
                  <div className="chartBarTrack">
                    <div
                      className="chartBarFill chartBarFillAlt"
                      style={{ width: calculateBarWidth(row.count, maxContentCount) }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyCard">还没有内容类型分布数据。</div>
            )}
          </div>
        </article>
      </section>

      <section className="twoColumnGrid dashboardGrid">
        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">最近动作</p>
              <h2 className="panelTitle">最新录入样本</h2>
            </div>
            <Link className="buttonGhost" href="/samples">
              查看档案
            </Link>
          </div>

          <div className="listStack">
            {stats.recent_samples.length > 0 ? (
              stats.recent_samples.map((sample) => (
                <Link className="listRow linkRow" href={`/samples/${sample.id}`} key={sample.id}>
                  <div>
                    <strong>{sample.title}</strong>
                    <p className="mutedText">
                      {[sample.track, sample.content_type].filter(Boolean).join(' · ') || '待分析'}
                    </p>
                  </div>
                  <StatusBadge status={sample.status} />
                </Link>
              ))
            ) : (
              <div className="emptyCard">还没有录入样本。</div>
            )}
          </div>
        </article>

        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">最近动作</p>
              <h2 className="panelTitle">最新生成任务</h2>
            </div>
            <Link className="buttonGhost" href="/create">
              去创作
            </Link>
          </div>

          <div className="listStack">
            {stats.recent_tasks.length > 0 ? (
              stats.recent_tasks.map((task) => (
                <Link className="listRow linkRow" href={buildHistoryTaskHref(task.id)} key={task.id}>
                  <div>
                    <strong>{task.topic}</strong>
                    <p className="mutedText">{task.reference_mode ?? '未记录参考模式'}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </Link>
              ))
            ) : (
              <div className="emptyCard">还没有生成任务。</div>
            )}
          </div>
        </article>
      </section>

      <section className="sectionCard">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">高价值参考</p>
            <h2 className="panelTitle">热门参考样本</h2>
          </div>
        </div>

        <div className="listStack">
          {stats.top_references.length > 0 ? (
            stats.top_references.map((sample) => (
              <Link className="listRow linkRow" href={`/samples/${sample.id}`} key={sample.id}>
                <div>
                  <strong>{sample.title}</strong>
                  <p className="mutedText">被引用 {sample.reference_count} 次</p>
                </div>
                <span className="badge badgeNeutral">Top</span>
              </Link>
            ))
          ) : (
            <div className="emptyCard">还没有任何样本被引用。</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default async function Home() {
  const stats = await getDashboardStats();

  return <HomePageContent stats={stats} />;
}
