import { resolveEnvValue } from './env';

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

export type SearchMode = 'hybrid' | 'lexical-only' | 'misconfigured';

export interface SearchModeStatus {
  searchMode: SearchMode;
  searchModeReason: string | null;
  embeddingModel: string;
}

export function resolveSearchModeStatus(
  env: NodeJS.ProcessEnv = process.env,
): SearchModeStatus {
  const embeddingApiKey = resolveEnvValue(env.EMBEDDING_API_KEY);
  const embeddingBaseUrl = resolveEnvValue(env.EMBEDDING_BASE_URL);
  const embeddingModel = resolveEnvValue(env.EMBEDDING_MODEL);
  const resolvedEmbeddingModel = embeddingModel ?? DEFAULT_EMBEDDING_MODEL;

  if (!embeddingApiKey || !embeddingBaseUrl || !embeddingModel) {
    return {
      searchMode: 'lexical-only',
      searchModeReason: 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。',
      embeddingModel: resolvedEmbeddingModel,
    };
  }

  return {
    searchMode: 'hybrid',
    searchModeReason: null,
    embeddingModel: resolvedEmbeddingModel,
  };
}

export function isHybridSearchMode(status: SearchModeStatus): boolean {
  return status.searchMode === 'hybrid';
}
