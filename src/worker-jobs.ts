import type { AnalysisResult } from '@/agents/schemas/analysis';
import type { VisualAnalysisResult } from '@/agents/schemas/visual-analysis';
import { resolveSearchModeStatus } from './lib/search-mode';

export interface AnalyzeJobLike {
  id?: string | number | undefined;
  data: {
    sampleId: string;
  };
}

type QueryResult<T> = Promise<T[]>;
type QueryOneResult<T> = Promise<T | null>;
type LogMethod = (...args: unknown[]) => void;

export interface AnalyzeJobDependencies {
  query: <T>(text: string, params?: unknown[]) => QueryResult<T>;
  queryOne: <T>(text: string, params?: unknown[]) => QueryOneResult<T>;
  analyzeText: (title: string, body: string) => Promise<AnalysisResult>;
  analyzeImage: (imageBuffer: Buffer) => Promise<VisualAnalysisResult>;
  storage: {
    getBuffer: (key: string) => Promise<Buffer>;
  };
  embedQueue: {
    add: (name: string, data: { sampleId: string }) => Promise<unknown>;
  };
  logger: {
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
  };
}

export interface EmbedJobDependencies {
  query: <T>(text: string, params?: unknown[]) => QueryResult<T>;
  queryOne: <T>(text: string, params?: unknown[]) => QueryOneResult<T>;
  createEmbedding: (text: string) => Promise<number[]>;
  logger: {
    info: LogMethod;
    error: LogMethod;
  };
}

export async function processAnalyzeJob(
  job: AnalyzeJobLike,
  dependencies: AnalyzeJobDependencies,
): Promise<void> {
  const { sampleId } = job.data;
  const searchModeStatus = resolveSearchModeStatus();
  dependencies.logger.info({ sampleId }, 'Starting analysis job');

  await dependencies.query('UPDATE samples SET status = $1 WHERE id = $2', ['analyzing', sampleId]);

  const sample = await dependencies.queryOne<{ title: string; body_text: string }>(
    'SELECT title, body_text FROM samples WHERE id = $1',
    [sampleId],
  );

  if (!sample) {
    throw new Error(`Sample ${sampleId} not found`);
  }

  const analysisResult = await dependencies.analyzeText(sample.title, sample.body_text);

  await dependencies.query(
    `
      INSERT INTO sample_analysis (
        sample_id, track, content_type, title_pattern_tags, opening_pattern_tags,
        structure_pattern_tags, emotion_level, trust_signal_tags, cta_type_tags,
        title_pattern_explanation, opening_explanation, structure_explanation,
        replicable_rules, avoid_points, reasoning_summary, model_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (sample_id) DO NOTHING
    `,
    [
      sampleId,
      analysisResult.track,
      analysisResult.content_type,
      analysisResult.title_pattern_tags,
      analysisResult.opening_pattern_tags ?? null,
      analysisResult.structure_pattern_tags ?? null,
      analysisResult.emotion_level,
      analysisResult.trust_signal_tags ?? null,
      analysisResult.cta_type_tags ?? null,
      analysisResult.title_pattern_explanation,
      analysisResult.opening_explanation ?? null,
      analysisResult.structure_explanation,
      analysisResult.replicable_rules,
      analysisResult.avoid_points ?? null,
      analysisResult.reasoning_summary,
      process.env.LLM_MODEL_ANALYSIS || 'gpt-4o',
    ],
  );

  const coverImage = await dependencies.queryOne<{ storage_key: string }>(
    'SELECT storage_key FROM sample_images WHERE sample_id = $1 AND image_type = $2 LIMIT 1',
    [sampleId, 'cover'],
  );

  if (coverImage?.storage_key) {
    try {
      const buffer = await dependencies.storage.getBuffer(coverImage.storage_key);
      const visualResult = await dependencies.analyzeImage(buffer);

      await dependencies.query(
        `
          INSERT INTO sample_visual_analysis (
            sample_id, extracted_text, cover_style_tag, layout_type_tag, text_density_tag,
            visual_focus_tag, main_colors, sticker_elements, cover_explanation, model_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (sample_id) DO NOTHING
        `,
        [
          sampleId,
          visualResult.extracted_text,
          visualResult.cover_style_tag,
          visualResult.layout_type_tag,
          visualResult.text_density_tag ?? null,
          visualResult.visual_focus_tag ?? null,
          visualResult.main_colors ?? null,
          visualResult.sticker_elements ?? null,
          visualResult.cover_explanation,
          process.env.LLM_MODEL_VISION || 'gpt-4o',
        ],
      );
    } catch (error) {
      dependencies.logger.warn(
        { error, sampleId, storageKey: coverImage.storage_key },
        'Visual analysis failed; continuing to next stage',
      );
    }
  }

  if (searchModeStatus.searchMode === 'misconfigured') {
    throw new Error(searchModeStatus.searchModeReason ?? 'Embedding provider is misconfigured.');
  }

  if (searchModeStatus.searchMode === 'lexical-only') {
    await dependencies.query('UPDATE samples SET status = $1 WHERE id = $2', ['completed', sampleId]);
    dependencies.logger.info({ sampleId }, 'Analysis job completed in lexical-only mode');
    return;
  }

  await dependencies.query('UPDATE samples SET status = $1 WHERE id = $2', ['embedding', sampleId]);
  await dependencies.embedQueue.add('embed', { sampleId });

  dependencies.logger.info({ sampleId }, 'Analysis job completed');
}

export async function processEmbedJob(
  job: AnalyzeJobLike,
  dependencies: EmbedJobDependencies,
): Promise<void> {
  const { sampleId } = job.data;
  dependencies.logger.info({ sampleId }, 'Starting embedding job');

  const sample = await dependencies.queryOne<{ title: string; body_text: string }>(
    'SELECT title, body_text FROM samples WHERE id = $1',
    [sampleId],
  );

  if (!sample) {
    throw new Error(`Sample ${sampleId} not found`);
  }

  const textToEmbed = `${sample.title}\n\n${sample.body_text}`;
  const embedding = await dependencies.createEmbedding(textToEmbed);
  const vectorStr = `[${embedding.join(',')}]`;

  await dependencies.query(
    `
      INSERT INTO sample_embeddings (sample_id, embedding, model_version)
      VALUES ($1, $2, $3)
    `,
    [sampleId, vectorStr, process.env.EMBEDDING_MODEL || 'text-embedding-3-small'],
  );

  await dependencies.query('UPDATE samples SET status = $1 WHERE id = $2', ['completed', sampleId]);

  dependencies.logger.info({ sampleId }, 'Embedding job completed');
}
