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
  const embeddingModel = resolveEnvValue(env.EMBEDDING_MODEL) ?? DEFAULT_EMBEDDING_MODEL;

  if (!embeddingApiKey && !embeddingBaseUrl && !resolveEnvValue(env.EMBEDDING_MODEL)) {
    return {
      searchMode: 'lexical-only',
      searchModeReason: 'EMBEDDING_* 未配置，已切换到 lexical-only 检索。',
      embeddingModel,
    };
  }

  if (!embeddingApiKey) {
    return {
      searchMode: 'misconfigured',
      searchModeReason: 'EMBEDDING_API_KEY is required when embedding is enabled.',
      embeddingModel,
    };
  }

  return {
    searchMode: 'hybrid',
    searchModeReason: null,
    embeddingModel,
  };
}

export function isHybridSearchMode(status: SearchModeStatus): boolean {
  return status.searchMode === 'hybrid';
}
