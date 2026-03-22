import type { SearchModeStatus } from './search-mode';

export interface BackfillMissingEmbeddingsDependencies {
  query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
  enqueueEmbeddingJob: (sampleId: string) => Promise<unknown>;
  getSearchModeStatus: () => SearchModeStatus;
}

export interface MissingEmbeddingSampleRow {
  sample_id: string;
}

export interface BackfillMissingEmbeddingsResult {
  queued: number;
}

export async function backfillMissingEmbeddings(
  dependencies: BackfillMissingEmbeddingsDependencies,
): Promise<BackfillMissingEmbeddingsResult> {
  const searchModeStatus = dependencies.getSearchModeStatus();

  if (searchModeStatus.searchMode !== 'hybrid') {
    throw new Error(
      searchModeStatus.searchModeReason ?? 'Embedding backfill requires hybrid search mode.',
    );
  }

  const missingSamples = await dependencies.query<MissingEmbeddingSampleRow>(
    `
      SELECT s.id AS sample_id
      FROM samples s
      LEFT JOIN sample_embeddings se ON se.sample_id = s.id
      WHERE s.status = $1 AND se.sample_id IS NULL
      ORDER BY s.created_at ASC
    `,
    ['completed'],
  );

  for (const sample of missingSamples) {
    await dependencies.enqueueEmbeddingJob(sample.sample_id);
  }

  return {
    queued: missingSamples.length,
  };
}
