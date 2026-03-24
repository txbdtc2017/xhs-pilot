import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSearchModeStatus } from './search-mode';

test('resolveSearchModeStatus falls back to lexical-only when embedding is not configured', () => {
  const status = resolveSearchModeStatus({
    EMBEDDING_API_KEY: '',
    EMBEDDING_BASE_URL: '',
    EMBEDDING_MODEL: '',
  });

  assert.equal(status.searchMode, 'lexical-only');
  assert.equal(status.searchModeReason, 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。');
  assert.equal(status.embeddingModel, 'text-embedding-3-small');
});

test('resolveSearchModeStatus falls back to lexical-only when embedding API key is missing', () => {
  const status = resolveSearchModeStatus({
    EMBEDDING_API_KEY: '',
    EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  });

  assert.equal(status.searchMode, 'lexical-only');
  assert.equal(status.searchModeReason, 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。');
});

test('resolveSearchModeStatus falls back to lexical-only when embedding base URL is missing', () => {
  const status = resolveSearchModeStatus({
    EMBEDDING_API_KEY: 'sk-embed',
    EMBEDDING_BASE_URL: '',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  });

  assert.equal(status.searchMode, 'lexical-only');
  assert.equal(status.searchModeReason, 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。');
});

test('resolveSearchModeStatus falls back to lexical-only when embedding model is missing', () => {
  const status = resolveSearchModeStatus({
    EMBEDDING_API_KEY: 'sk-embed',
    EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
    EMBEDDING_MODEL: '',
  });

  assert.equal(status.searchMode, 'lexical-only');
  assert.equal(status.searchModeReason, 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。');
});

test('resolveSearchModeStatus enables hybrid mode only when all embedding fields are configured', () => {
  const status = resolveSearchModeStatus({
    EMBEDDING_API_KEY: 'sk-embed',
    EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  });

  assert.equal(status.searchMode, 'hybrid');
  assert.equal(status.searchModeReason, null);
});
