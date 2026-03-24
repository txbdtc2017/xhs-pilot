import { query, queryOne, type ParameterizedQuery } from './db';

export type SampleListView = 'active' | 'trash';

export interface SampleListFilters {
  view?: SampleListView;
  search?: string;
  track?: string;
  contentType?: string;
  coverStyle?: string;
  isHighValue?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export interface SampleListItem {
  id: string;
  title: string;
  status: string;
  track: string | null;
  content_type: string | null;
  cover_style_tag: string | null;
  is_high_value: boolean;
  reference_count: number;
  cover_url: string | null;
  created_at: string;
}

export interface SampleFilterOptions {
  tracks: string[];
  contentTypes: string[];
  coverStyles: string[];
}

export interface SampleSelectOption {
  id: string;
  title: string;
  status: string;
}

export interface RelatedSample {
  id: string;
  title: string;
  similarity: number;
  track: string | null;
  content_type: string | null;
  cover_url: string | null;
}

export interface ReferencedByTask {
  task_id: string;
  topic: string;
  status: string;
  reference_mode: string | null;
  reference_type: string;
  reason: string | null;
  created_at: string;
}

export interface StyleProfileMembership {
  id: string;
  name: string;
  description: string | null;
}

export interface SampleDetailPayload {
  sample: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  visualAnalysis: Record<string, unknown> | null;
  images: Array<Record<string, unknown>>;
  related_samples: RelatedSample[];
  referenced_by_tasks: ReferencedByTask[];
  style_profiles: StyleProfileMembership[];
}

export interface SamplePatchInput {
  is_high_value?: boolean;
  is_reference_allowed?: boolean;
  manual_tags?: string[];
  manual_notes?: string | null;
}

interface StorageKeyRow {
  storage_key: string | null;
}

export type SampleMutationResult =
  | { success: true }
  | { error: 'not_found' | 'already_deleted' | 'not_deleted' };

export type SamplePermanentDeleteResult =
  | { success: true; images: StorageKeyRow[] }
  | { error: 'not_found' | 'not_deleted' };

interface SampleDeletionStateRow {
  deleted_at: string | null;
}

export function normalizeSampleListView(rawValue: string | null | undefined): SampleListView {
  return rawValue === 'trash' ? 'trash' : 'active';
}

function buildSampleListWhereClause(filters: Omit<SampleListFilters, 'page' | 'limit'>) {
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  const view = normalizeSampleListView(filters.view);

  const addParam = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  whereClauses.push(view === 'trash' ? 's.deleted_at IS NOT NULL' : 's.deleted_at IS NULL');

  if (filters.track) {
    whereClauses.push(`sa.track = ${addParam(filters.track)}`);
  }

  if (filters.contentType) {
    whereClauses.push(`sa.content_type = ${addParam(filters.contentType)}`);
  }

  if (filters.coverStyle) {
    whereClauses.push(`sva.cover_style_tag = ${addParam(filters.coverStyle)}`);
  }

  if (typeof filters.isHighValue === 'boolean') {
    whereClauses.push(`s.is_high_value = ${addParam(filters.isHighValue)}`);
  }

  if (filters.search) {
    whereClauses.push(`(s.title ILIKE ${addParam(`%${filters.search}%`)} OR s.body_text ILIKE $${values.length})`);
  }

  if (filters.dateFrom) {
    whereClauses.push(`s.created_at >= ${addParam(filters.dateFrom)}::date`);
  }

  if (filters.dateTo) {
    whereClauses.push(`s.created_at < (${addParam(filters.dateTo)}::date + INTERVAL '1 day')`);
  }

  return {
    values,
    whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
  };
}

export function buildListSamplesQuery(filters: SampleListFilters): ParameterizedQuery {
  const { values, whereSql } = buildSampleListWhereClause(filters);
  const offset = (filters.page - 1) * filters.limit;
  const limitParam = `$${values.push(filters.limit)}`;
  const offsetParam = `$${values.push(offset)}`;

  return {
    text: `
      SELECT
        s.id,
        s.title,
        s.status,
        s.is_high_value,
        s.created_at,
        sa.track,
        sa.content_type,
        sva.cover_style_tag,
        (
          SELECT si.image_url
          FROM sample_images si
          WHERE si.sample_id = s.id AND si.image_type = 'cover'
          ORDER BY si.sort_order ASC
          LIMIT 1
        ) AS cover_url,
        COALESCE(ref.reference_count, 0) AS reference_count
      FROM samples s
      LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
      LEFT JOIN sample_visual_analysis sva ON sva.sample_id = s.id
      LEFT JOIN (
        SELECT sample_id, COUNT(*)::int AS reference_count
        FROM task_references
        GROUP BY sample_id
      ) ref ON ref.sample_id = s.id
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    values,
  };
}

function buildListSamplesCountQuery(filters: SampleListFilters): ParameterizedQuery {
  const { values, whereSql } = buildSampleListWhereClause(filters);

  return {
    text: `
      SELECT COUNT(*)::int AS total
      FROM samples s
      LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
      LEFT JOIN sample_visual_analysis sva ON sva.sample_id = s.id
      ${whereSql}
    `,
    values,
  };
}

export function buildRelatedSamplesQuery({
  sampleId,
  limit = 5,
}: {
  sampleId: string;
  limit?: number;
}): ParameterizedQuery {
  return {
    text: `
      WITH current_embedding AS (
        SELECT current_embedding.sample_id, current_embedding.embedding
        FROM sample_embeddings AS current_embedding
        WHERE current_embedding.sample_id = $1
      )
      SELECT
        s.id,
        s.title,
        sa.track,
        sa.content_type,
        (
          SELECT si.image_url
          FROM sample_images si
          WHERE si.sample_id = s.id AND si.image_type = 'cover'
          ORDER BY si.sort_order ASC
          LIMIT 1
        ) AS cover_url,
        LEAST(1, GREATEST(0, 1 - (candidate.embedding <=> current_embedding.embedding))) AS similarity
      FROM current_embedding
      INNER JOIN sample_embeddings candidate ON candidate.sample_id <> $1
      INNER JOIN samples s ON s.id = candidate.sample_id
      LEFT JOIN sample_analysis sa ON sa.sample_id = s.id
      WHERE s.deleted_at IS NULL
      ORDER BY similarity DESC
      LIMIT $2
    `,
    values: [sampleId, limit],
  };
}

export async function listSamples(filters: SampleListFilters): Promise<{
  samples: SampleListItem[];
  total: number;
}> {
  const countQuery = buildListSamplesCountQuery(filters);
  const listQuery = buildListSamplesQuery(filters);

  const [totalRow, samples] = await Promise.all([
    queryOne<{ total: number }>(countQuery.text, countQuery.values),
    query<SampleListItem>(listQuery.text, listQuery.values),
  ]);

  return {
    samples,
    total: totalRow?.total ?? 0,
  };
}

export async function getSampleFilterOptions(
  view: SampleListView = 'active',
): Promise<SampleFilterOptions> {
  const deletedWhereClause = view === 'trash' ? 's.deleted_at IS NOT NULL' : 's.deleted_at IS NULL';

  const [tracks, contentTypes, coverStyles] = await Promise.all([
    query<{ value: string }>(
      `
        SELECT DISTINCT track AS value
        FROM sample_analysis sa
        INNER JOIN samples s ON s.id = sa.sample_id
        WHERE ${deletedWhereClause} AND track IS NOT NULL AND track <> ''
        ORDER BY track ASC
      `,
    ),
    query<{ value: string }>(
      `
        SELECT DISTINCT content_type AS value
        FROM sample_analysis sa
        INNER JOIN samples s ON s.id = sa.sample_id
        WHERE ${deletedWhereClause} AND content_type IS NOT NULL AND content_type <> ''
        ORDER BY content_type ASC
      `,
    ),
    query<{ value: string }>(
      `
        SELECT DISTINCT cover_style_tag AS value
        FROM sample_visual_analysis sva
        INNER JOIN samples s ON s.id = sva.sample_id
        WHERE ${deletedWhereClause} AND cover_style_tag IS NOT NULL AND cover_style_tag <> ''
        ORDER BY cover_style_tag ASC
      `,
    ),
  ]);

  return {
    tracks: tracks.map((row) => row.value),
    contentTypes: contentTypes.map((row) => row.value),
    coverStyles: coverStyles.map((row) => row.value),
  };
}

export async function listSampleSelectOptions(limit = 50): Promise<SampleSelectOption[]> {
  return query<SampleSelectOption>(
    `
      SELECT id, title, status
      FROM samples
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );
}

export async function getSampleDetail(sampleId: string): Promise<SampleDetailPayload | null> {
  const sample = await queryOne<Record<string, unknown>>(
    `SELECT * FROM samples WHERE id = $1`,
    [sampleId],
  );

  if (!sample) {
    return null;
  }

  const relatedQuery = buildRelatedSamplesQuery({ sampleId });

  const [images, analysis, visualAnalysis, relatedSamples, referencedByTasks, styleProfiles] =
    await Promise.all([
      query<Record<string, unknown>>(
        `SELECT * FROM sample_images WHERE sample_id = $1 ORDER BY sort_order ASC`,
        [sampleId],
      ),
      queryOne<Record<string, unknown>>(
        `SELECT * FROM sample_analysis WHERE sample_id = $1`,
        [sampleId],
      ),
      queryOne<Record<string, unknown>>(
        `SELECT * FROM sample_visual_analysis WHERE sample_id = $1`,
        [sampleId],
      ),
      query<RelatedSample>(relatedQuery.text, relatedQuery.values),
      query<ReferencedByTask>(
        `
          SELECT
            gt.id AS task_id,
            gt.topic,
            gt.status,
            gt.reference_mode,
            tr.reference_type,
            tr.reason,
            gt.created_at
          FROM task_references tr
          INNER JOIN generation_tasks gt ON gt.id = tr.task_id
          WHERE tr.sample_id = $1
          ORDER BY gt.created_at DESC
          LIMIT 8
        `,
        [sampleId],
      ),
      query<StyleProfileMembership>(
        `
          SELECT sp.id, sp.name, sp.description
          FROM style_profile_samples sps
          INNER JOIN style_profiles sp ON sp.id = sps.style_profile_id
          WHERE sps.sample_id = $1
          ORDER BY sp.updated_at DESC, sp.name ASC
        `,
        [sampleId],
      ),
    ]);

  return {
    sample,
    analysis,
    visualAnalysis,
    images,
    related_samples: relatedSamples,
    referenced_by_tasks: referencedByTasks,
    style_profiles: styleProfiles,
  };
}

export async function updateSample(
  sampleId: string,
  patch: SamplePatchInput,
): Promise<Record<string, unknown> | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (patch.is_high_value !== undefined) {
    fields.push(`is_high_value = $${index++}`);
    values.push(patch.is_high_value);
  }

  if (patch.is_reference_allowed !== undefined) {
    fields.push(`is_reference_allowed = $${index++}`);
    values.push(patch.is_reference_allowed);
  }

  if (patch.manual_tags !== undefined) {
    fields.push(`manual_tags = $${index++}`);
    values.push(patch.manual_tags);
  }

  if (patch.manual_notes !== undefined) {
    fields.push(`manual_notes = $${index++}`);
    values.push(patch.manual_notes);
  }

  if (fields.length === 0) {
    return null;
  }

  fields.push(`updated_at = NOW()`);
  values.push(sampleId);

  return queryOne<Record<string, unknown>>(
    `
      UPDATE samples
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING *
    `,
    values,
  );
}

async function getSampleDeletionState(sampleId: string): Promise<SampleDeletionStateRow | null> {
  return queryOne<SampleDeletionStateRow>(
    `SELECT deleted_at FROM samples WHERE id = $1`,
    [sampleId],
  );
}

export async function softDeleteSample(sampleId: string): Promise<SampleMutationResult> {
  const state = await getSampleDeletionState(sampleId);

  if (!state) {
    return { error: 'not_found' };
  }

  if (state.deleted_at) {
    return { error: 'already_deleted' };
  }

  await query(
    `
      UPDATE samples
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [sampleId],
  );

  return { success: true };
}

export async function restoreSample(sampleId: string): Promise<SampleMutationResult> {
  const state = await getSampleDeletionState(sampleId);

  if (!state) {
    return { error: 'not_found' };
  }

  if (!state.deleted_at) {
    return { error: 'not_deleted' };
  }

  await query(
    `
      UPDATE samples
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    [sampleId],
  );

  return { success: true };
}

export async function deleteSample(sampleId: string): Promise<StorageKeyRow[]> {
  const images = await query<StorageKeyRow>(
    `
      SELECT storage_key
      FROM sample_images
      WHERE sample_id = $1 AND storage_key IS NOT NULL
    `,
    [sampleId],
  );

  await query(`DELETE FROM samples WHERE id = $1`, [sampleId]);
  return images;
}

export async function permanentlyDeleteSample(
  sampleId: string,
): Promise<SamplePermanentDeleteResult> {
  const state = await getSampleDeletionState(sampleId);

  if (!state) {
    return { error: 'not_found' };
  }

  if (!state.deleted_at) {
    return { error: 'not_deleted' };
  }

  return {
    success: true,
    images: await deleteSample(sampleId),
  };
}
