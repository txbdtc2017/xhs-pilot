import { query, queryOne } from './db';

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
    queryOne<{ total: number }>(`SELECT COUNT(*)::int AS total FROM samples`),
    queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM samples WHERE created_at >= DATE_TRUNC('week', NOW())`,
    ),
    queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM samples WHERE is_high_value = true`,
    ),
    queryOne<{ total: number }>(`SELECT COUNT(*)::int AS total FROM style_profiles`),
    query<DashboardDistributionRow>(
      `
        SELECT COALESCE(sa.track, '未分类') AS label, COUNT(*)::int AS count
        FROM samples s
        LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
        GROUP BY COALESCE(sa.track, '未分类')
        ORDER BY count DESC, label ASC
        LIMIT 8
      `,
    ),
    query<DashboardDistributionRow>(
      `
        SELECT COALESCE(sa.content_type, '未分类') AS label, COUNT(*)::int AS count
        FROM samples s
        LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
        GROUP BY COALESCE(sa.content_type, '未分类')
        ORDER BY count DESC, label ASC
        LIMIT 8
      `,
    ),
    query<DashboardRecentSample>(
      `
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
        ORDER BY s.created_at DESC
        LIMIT 5
      `,
    ),
    query<DashboardRecentTask>(
      `
        SELECT id, topic, status, reference_mode, created_at
        FROM generation_tasks
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ),
    query<DashboardTopReference>(
      `
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
        GROUP BY s.id, s.title
        ORDER BY reference_count DESC, s.title ASC
        LIMIT 5
      `,
    ),
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
