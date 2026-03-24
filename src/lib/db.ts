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

export interface SearchLexicalSamplesParams {
  query: string;
  topic?: string;
  filters: {
    track?: string;
    content_type?: string[];
    title_pattern_hints?: string[];
    is_reference_allowed?: boolean;
  };
  limit?: number;
}

export interface ParameterizedQuery {
  text: string;
  values: unknown[];
}

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

interface LexicalTerm {
  value: string;
  weight: number;
}

const LEXICAL_FIELD_WEIGHTS = [
  { expression: 's.title', weight: 4 },
  { expression: 'sa.title_pattern_explanation', weight: 3 },
  { expression: 'sa.reasoning_summary', weight: 2.5 },
  { expression: 'sa.structure_explanation', weight: 2.5 },
  { expression: 'sa.opening_explanation', weight: 2 },
  { expression: 's.body_text', weight: 1.5 },
  { expression: 'sva.extracted_text', weight: 1.25 },
  { expression: 'sva.cover_explanation', weight: 1.25 },
] as const;

function hasValues(values?: string[]): values is string[] {
  return Array.isArray(values) && values.length > 0;
}

export function serializeVectorForPg(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function upsertLexicalTerm(store: Map<string, number>, value: string, weight: number): void {
  if (!value) {
    return;
  }

  const current = store.get(value) ?? 0;
  if (weight > current) {
    store.set(value, weight);
  }
}

function extractLexicalTermsFromText(
  raw: string | undefined,
  sourceWeight: number,
  store: Map<string, number>,
): void {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) {
    return;
  }

  const segments = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const segment of segments) {
    if (/[\u4e00-\u9fff]/u.test(segment)) {
      const chars = Array.from(segment).filter((char) => /[\u4e00-\u9fff]/u.test(char));
      if (chars.length >= 2) {
        upsertLexicalTerm(store, chars.join(''), 3 * sourceWeight);
      }

      for (let index = 0; index < chars.length - 1; index += 1) {
        upsertLexicalTerm(store, `${chars[index]}${chars[index + 1]}`, 1 * sourceWeight);
      }

      continue;
    }

    if (/^\d+$/u.test(segment)) {
      continue;
    }

    if (/^[a-z0-9_]+$/iu.test(segment) && segment.length < 2) {
      continue;
    }

    upsertLexicalTerm(store, segment, 2 * sourceWeight);
  }
}

function buildLexicalTerms(query: string, topic?: string): LexicalTerm[] {
  const store = new Map<string, number>();
  extractLexicalTermsFromText(query, 1, store);
  extractLexicalTermsFromText(topic, 0.5, store);

  return Array.from(store.entries()).map(([value, weight]) => ({ value, weight }));
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
  whereClauses.push('s.deleted_at IS NULL');
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

export function buildSearchLexicalSamplesQuery({
  query,
  topic,
  filters,
  limit = DEFAULT_SEARCH_LIMIT,
}: SearchLexicalSamplesParams): ParameterizedQuery {
  const values: unknown[] = [];
  const whereClauses: string[] = [];
  const lexicalTerms = buildLexicalTerms(query, topic);

  if (lexicalTerms.length === 0) {
    return {
      text: `
        SELECT
          s.id AS sample_id,
          s.title,
          0::float AS similarity,
          sa.track,
          sa.content_type,
          sa.reasoning_summary,
          sa.title_pattern_explanation,
          sa.opening_explanation,
          sa.structure_explanation,
          sva.cover_explanation
        FROM samples s
        INNER JOIN sample_analysis sa ON sa.sample_id = s.id
        LEFT JOIN sample_visual_analysis sva ON sva.sample_id = s.id
        WHERE FALSE
      `,
      values,
    };
  }

  const addParam = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (typeof filters.is_reference_allowed === 'boolean') {
    whereClauses.push(`s.is_reference_allowed = ${addParam(filters.is_reference_allowed)}`);
  }

  whereClauses.push('s.deleted_at IS NULL');

  if (filters.track) {
    whereClauses.push(`sa.track = ${addParam(filters.track)}`);
  }

  if (hasValues(filters.content_type)) {
    whereClauses.push(`sa.content_type = ANY(${addParam(filters.content_type)}::text[])`);
  }

  if (hasValues(filters.title_pattern_hints)) {
    whereClauses.push(`sa.title_pattern_tags && ${addParam(filters.title_pattern_hints)}::text[]`);
  }

  const matchedWeightParts: string[] = [];
  const lexicalScoreParts: string[] = [];
  const anyMatchParts: string[] = [];

  for (const term of lexicalTerms) {
    const patternParam = addParam(`%${term.value}%`);
    const fieldMatches = LEXICAL_FIELD_WEIGHTS.map(
      (field) => `${field.expression} ILIKE ${patternParam}`,
    );
    const anyFieldMatch = `(${fieldMatches.join(' OR ')})`;
    anyMatchParts.push(anyFieldMatch);
    matchedWeightParts.push(`CASE WHEN ${anyFieldMatch} THEN ${term.weight} ELSE 0 END`);

    for (const field of LEXICAL_FIELD_WEIGHTS) {
      lexicalScoreParts.push(
        `CASE WHEN ${field.expression} ILIKE ${patternParam} THEN ${term.weight * field.weight} ELSE 0 END`,
      );
    }
  }

  whereClauses.push(`(${anyMatchParts.join(' OR ')})`);

  const totalWeight = lexicalTerms.reduce((sum, term) => sum + term.weight, 0);
  const similarityExpr =
    totalWeight > 0
      ? `LEAST(1, GREATEST(0, ((${matchedWeightParts.join(' + ')})::float / ${totalWeight})))`
      : '0';
  const lexicalScoreExpr = lexicalScoreParts.length > 0 ? lexicalScoreParts.join(' + ') : '0';
  const limitParam = addParam(limit);

  return {
    text: `
      SELECT
        ranked.sample_id,
        ranked.title,
        ranked.similarity,
        ranked.track,
        ranked.content_type,
        ranked.reasoning_summary,
        ranked.title_pattern_explanation,
        ranked.opening_explanation,
        ranked.structure_explanation,
        ranked.cover_explanation
      FROM (
        SELECT
          s.id AS sample_id,
          s.title,
          ${similarityExpr} AS similarity,
          ${lexicalScoreExpr} AS lexical_score,
          sa.track,
          sa.content_type,
          sa.reasoning_summary,
          sa.title_pattern_explanation,
          sa.opening_explanation,
          sa.structure_explanation,
          sva.cover_explanation
        FROM samples s
        INNER JOIN sample_analysis sa ON sa.sample_id = s.id
        LEFT JOIN sample_visual_analysis sva ON sva.sample_id = s.id
        WHERE ${whereClauses.join(' AND ')}
      ) ranked
      ORDER BY ranked.similarity DESC, ranked.lexical_score DESC, ranked.sample_id ASC
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

export async function searchLexicalSamples(
  params: SearchLexicalSamplesParams,
): Promise<SimilarSample[]> {
  const builtQuery = buildSearchLexicalSamplesQuery(params);
  const rows = await query<SimilarSample>(builtQuery.text, builtQuery.values);

  return rows.map((row) => ({
    ...row,
    similarity: clampSimilarity(Number(row.similarity)),
  }));
}
