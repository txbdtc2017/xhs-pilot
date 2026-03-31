import { query, queryOne } from './db';

const ACTIVE_SAMPLE_PREDICATE = 's.deleted_at IS NULL';

export interface DashboardOverview {
  total_samples: number;
  new_samples_this_week: number;
  high_value_samples: number;
  style_profiles: number;
}

export interface DashboardDistributionRow {
  label: string;
  count: number;
}

export interface DashboardRecentSample {
  id: string;
  title: string;
  status?: string;
  track?: string | null;
  content_type?: string | null;
  created_at?: string;
  cover_url?: string | null;
}

export interface DashboardRecentTask {
  id: string;
  topic: string;
  status?: string;
  reference_mode?: string | null;
  created_at?: string;
}

export interface DashboardTopReference {
  id: string;
  title: string;
  reference_count: number;
  cover_url?: string | null;
}

export interface DashboardStats {
  overview: DashboardOverview;
  track_distribution: DashboardDistributionRow[];
  content_type_distribution: DashboardDistributionRow[];
  recent_samples: DashboardRecentSample[];
  recent_tasks: DashboardRecentTask[];
  top_references: DashboardTopReference[];
}

export function buildDashboardTotalSamplesQuery() {
  return `SELECT COUNT(*)::int AS total FROM samples s WHERE ${ACTIVE_SAMPLE_PREDICATE}`;
}

export function buildDashboardNewSamplesQuery() {
  return `SELECT COUNT(*)::int AS total FROM samples s WHERE ${ACTIVE_SAMPLE_PREDICATE} AND s.created_at >= DATE_TRUNC('week', NOW())`;
}

export function buildDashboardHighValueSamplesQuery() {
  return `SELECT COUNT(*)::int AS total FROM samples s WHERE ${ACTIVE_SAMPLE_PREDICATE} AND s.is_high_value = true`;
}

export function buildDashboardTrackDistributionQuery() {
  return `
    SELECT COALESCE(sa.track, '未分类') AS label, COUNT(*)::int AS count
    FROM samples s
    LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
    WHERE ${ACTIVE_SAMPLE_PREDICATE}
    GROUP BY COALESCE(sa.track, '未分类')
    ORDER BY count DESC, label ASC
    LIMIT 8
  `;
}

export function buildDashboardContentTypeDistributionQuery() {
  return `
    SELECT COALESCE(sa.content_type, '未分类') AS label, COUNT(*)::int AS count
    FROM samples s
    LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
    WHERE ${ACTIVE_SAMPLE_PREDICATE}
    GROUP BY COALESCE(sa.content_type, '未分类')
    ORDER BY count DESC, label ASC
    LIMIT 8
  `;
}

export function buildDashboardRecentSamplesQuery() {
  return `
    SELECT
      s.id,
      s.title,
      s.status,
      s.created_at,
      sa.track,
      sa.content_type,
      (
        SELECT si.image_url
        FROM sample_images si
        WHERE si.sample_id = s.id AND si.image_type = 'cover'
        ORDER BY si.sort_order ASC
        LIMIT 1
      ) AS cover_url
    FROM samples s
    LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
    WHERE ${ACTIVE_SAMPLE_PREDICATE}
    ORDER BY s.created_at DESC
    LIMIT 5
  `;
}

export function buildDashboardTopReferencesQuery() {
  return `
    SELECT
      s.id,
      s.title,
      COUNT(tr.id)::int AS reference_count,
      (
        SELECT si.image_url
        FROM sample_images si
        WHERE si.sample_id = s.id AND si.image_type = 'cover'
        ORDER BY si.sort_order ASC
        LIMIT 1
      ) AS cover_url
    FROM task_references tr
    INNER JOIN samples s ON s.id = tr.sample_id
    WHERE ${ACTIVE_SAMPLE_PREDICATE}
    GROUP BY s.id, s.title
    ORDER BY reference_count DESC, s.title ASC
    LIMIT 5
  `;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalSamplesRow,
    newSamplesRow,
    highValueSamplesRow,
    styleProfilesRow,
    trackDistribution,
    contentTypeDistribution,
    recentSamples,
    recentTasks,
    topReferences,
  ] = await Promise.all([
    queryOne<{ total: number }>(buildDashboardTotalSamplesQuery()),
    queryOne<{ total: number }>(buildDashboardNewSamplesQuery()),
    queryOne<{ total: number }>(buildDashboardHighValueSamplesQuery()),
    queryOne<{ total: number }>(`SELECT COUNT(*)::int AS total FROM style_profiles`),
    query<DashboardDistributionRow>(buildDashboardTrackDistributionQuery()),
    query<DashboardDistributionRow>(buildDashboardContentTypeDistributionQuery()),
    query<DashboardRecentSample>(buildDashboardRecentSamplesQuery()),
    query<DashboardRecentTask>(
      `
        SELECT id, topic, status, reference_mode, created_at
        FROM generation_tasks
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ),
    query<DashboardTopReference>(buildDashboardTopReferencesQuery()),
  ]);

  return {
    overview: {
      total_samples: totalSamplesRow?.total ?? 0,
      new_samples_this_week: newSamplesRow?.total ?? 0,
      high_value_samples: highValueSamplesRow?.total ?? 0,
      style_profiles: styleProfilesRow?.total ?? 0,
    },
    track_distribution: trackDistribution,
    content_type_distribution: contentTypeDistribution,
    recent_samples: recentSamples,
    recent_tasks: recentTasks,
    top_references: topReferences,
  };
}
