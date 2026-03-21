import { Pool } from 'pg';
import { resolveDatabaseUrl } from './env';
import { logger } from './logger';

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(process.env),
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle client');
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: res.rowCount }, 'Executed query');
    return res.rows;
  } catch (err) {
    logger.error({ err, text, params }, 'Query failed');
    throw err;
  }
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export interface SimilarSample {
  sample_id: string;
  title: string;
  similarity: number;
  track: string | null;
  content_type: string | null;
  reasoning_summary: string | null;
  title_pattern_explanation: string | null;
  opening_explanation: string | null;
  structure_explanation: string | null;
  cover_explanation?: string | null;
}

export interface SearchSimilarSamplesParams {
  taskEmbedding: number[];
  filters: {
    track?: string;
    content_type?: string[];
    title_pattern_hints?: string[];
    is_reference_allowed?: boolean;
  };
  limit?: number;
  similarityThreshold?: number;
}

export interface ParameterizedQuery {
  text: string;
  values: unknown[];
}

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

function hasValues(values?: string[]): values is string[] {
  return Array.isArray(values) && values.length > 0;
}

export function serializeVectorForPg(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function buildSearchSimilarSamplesQuery({
  taskEmbedding,
  filters,
  limit = DEFAULT_SEARCH_LIMIT,
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
}: SearchSimilarSamplesParams): ParameterizedQuery {
  const values: unknown[] = [serializeVectorForPg(taskEmbedding)];
  const whereClauses: string[] = [];

  const addParam = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (typeof filters.is_reference_allowed === 'boolean') {
    whereClauses.push(`s.is_reference_allowed = ${addParam(filters.is_reference_allowed)}`);
  }

  if (filters.track) {
    whereClauses.push(`sa.track = ${addParam(filters.track)}`);
  }

  if (hasValues(filters.content_type)) {
    whereClauses.push(`sa.content_type = ANY(${addParam(filters.content_type)}::text[])`);
  }

  if (hasValues(filters.title_pattern_hints)) {
    whereClauses.push(`sa.title_pattern_tags && ${addParam(filters.title_pattern_hints)}::text[]`);
  }

  const similarityExpr = 'LEAST(1, GREATEST(0, 1 - (se.embedding <=> $1::vector)))';
  whereClauses.push(`${similarityExpr} >= ${addParam(similarityThreshold)}`);

  const limitParam = addParam(limit);
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return {
    text: `
      SELECT
        s.id AS sample_id,
        s.title,
        ${similarityExpr} AS similarity,
        sa.track,
        sa.content_type,
        sa.reasoning_summary,
        sa.title_pattern_explanation,
        sa.opening_explanation,
        sa.structure_explanation,
        sva.cover_explanation
      FROM samples s
      INNER JOIN sample_analysis sa ON sa.sample_id = s.id
      INNER JOIN sample_embeddings se ON se.sample_id = s.id
      LEFT JOIN sample_visual_analysis sva ON sva.sample_id = s.id
      ${whereSql}
      ORDER BY se.embedding <=> $1::vector ASC
      LIMIT ${limitParam}
    `,
    values,
  };
}

function clampSimilarity(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export async function searchSimilarSamples(
  params: SearchSimilarSamplesParams,
): Promise<SimilarSample[]> {
  const builtQuery = buildSearchSimilarSamplesQuery(params);
  const rows = await query<SimilarSample>(builtQuery.text, builtQuery.values);

  return rows.map((row) => ({
    ...row,
    similarity: clampSimilarity(Number(row.similarity)),
  }));
}
