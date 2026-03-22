import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { getDashboardStats } from '@/lib/dashboard';
import { buildHistoryTaskHref } from './create/history';

export const dynamic = 'force-dynamic';

function calculateBarWidth(value: number, max: number): string {
  if (max <= 0) {
    return '0%';
  }

  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

export default async function Home() {
  const stats = await getDashboardStats();
  const maxTrackCount = Math.max(...stats.track_distribution.map((row) => row.count), 0);
  const maxContentCount = Math.max(...stats.content_type_distribution.map((row) => row.count), 0);

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <p className="eyebrow">Dashboard</p>
        <h1 className="pageTitle">看清系统沉淀了什么，最近又在产生什么。</h1>
        <p className="pageSubtitle">
          这里展示样本资产规模、分布、最近活动和高频参考，帮助你判断内容库是否在持续变得更可用。
        </p>
      </header>

      <section className="metricGrid">
        <article className="metricCard">
          <p className="metricLabel">总样本数</p>
          <strong className="metricValue">{stats.overview.total_samples}</strong>
        </article>
        <article className="metricCard">
          <p className="metricLabel">本周新增</p>
          <strong className="metricValue">{stats.overview.new_samples_this_week}</strong>
        </article>
        <article className="metricCard">
          <p className="metricLabel">高价值样本</p>
          <strong className="metricValue">{stats.overview.high_value_samples}</strong>
        </article>
        <article className="metricCard">
          <p className="metricLabel">风格画像</p>
          <strong className="metricValue">{stats.overview.style_profiles}</strong>
        </article>
      </section>

      <section className="twoColumnGrid">
        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Track Distribution</p>
              <h2 className="panelTitle">赛道分布</h2>
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
              <p className="eyebrow">Content Type</p>
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

      <section className="twoColumnGrid">
        <article className="sectionCard">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Recent Samples</p>
              <h2 className="panelTitle">最近录入的样本</h2>
            </div>
            <Link className="buttonGhost" href="/samples">
              查看样本库
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
              <p className="eyebrow">Recent Tasks</p>
              <h2 className="panelTitle">最近生成任务</h2>
            </div>
            <Link className="buttonGhost" href="/create">
              去创作工作台
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
            <p className="eyebrow">Top References</p>
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
