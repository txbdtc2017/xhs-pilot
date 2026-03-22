import assert from 'node:assert/strict';
import test from 'node:test';

import { createProviderFactories, resolveProviderOptions } from './llm';

test('resolveProviderOptions defaults the shared LLM protocol to openai and lets vision inherit it', () => {
  const resolved = resolveProviderOptions({
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
  });

  assert.deepEqual(resolved.llm, {
    protocol: 'openai',
    apiKey: 'main-key',
    baseURL: 'https://llm.example/v1',
  });

  assert.deepEqual(resolved.vision, {
    protocol: 'openai',
    apiKey: 'main-key',
    baseURL: 'https://llm.example/v1',
  });
});

test('resolveProviderOptions falls back to the base LLM provider for vision when VISION_* is unset', () => {
  const resolved = resolveProviderOptions({
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
  });

  assert.deepEqual(resolved.vision, {
    protocol: 'openai',
    apiKey: 'main-key',
    baseURL: 'https://llm.example/v1',
  });
});

test('resolveProviderOptions lets vision reuse the LLM API key when only VISION_BASE_URL is set', () => {
  const resolved = resolveProviderOptions({
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
    VISION_BASE_URL: 'https://vision.example/v1',
  });

  assert.deepEqual(resolved.vision, {
    protocol: 'openai',
    apiKey: 'main-key',
    baseURL: 'https://vision.example/v1',
  });
});

test('resolveProviderOptions lets vision reuse the LLM base URL when only VISION_API_KEY is set', () => {
  const resolved = resolveProviderOptions({
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
    VISION_API_KEY: 'vision-key',
  });

  assert.deepEqual(resolved.vision, {
    protocol: 'openai',
    apiKey: 'vision-key',
    baseURL: 'https://llm.example/v1',
  });
});

test('resolveProviderOptions prefers explicit VISION_* values over the shared LLM provider', () => {
  const resolved = resolveProviderOptions({
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
    VISION_API_KEY: 'vision-key',
    VISION_BASE_URL: 'https://vision.example/v1',
  });

  assert.deepEqual(resolved.vision, {
    protocol: 'openai',
    apiKey: 'vision-key',
    baseURL: 'https://vision.example/v1',
  });
});

test('resolveProviderOptions lets vision override the shared protocol while keeping per-field credential fallback', () => {
  const resolved = resolveProviderOptions({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
    VISION_PROTOCOL: 'openai',
  });

  assert.deepEqual(resolved.llm, {
    protocol: 'anthropic-messages',
    apiKey: 'main-key',
    baseURL: 'https://llm.example/v1',
  });

  assert.deepEqual(resolved.vision, {
    protocol: 'openai',
    apiKey: 'main-key',
    baseURL: 'https://llm.example/v1',
  });
});

test('resolveProviderOptions rejects unsupported protocol values', () => {
  assert.throws(
    () => resolveProviderOptions({
      LLM_PROTOCOL: 'moonshot',
      LLM_API_KEY: 'main-key',
      LLM_BASE_URL: 'https://llm.example/v1',
    }),
    /LLM_PROTOCOL must be "openai" or "anthropic-messages"/,
  );
});

test('createProviderFactories keeps embedding on the openai-compatible provider when llm uses anthropic-messages', () => {
  const providers = createProviderFactories({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_API_KEY: 'anthropic-key',
    LLM_BASE_URL: 'https://anthropic.example/v1',
    VISION_API_KEY: 'vision-key',
    VISION_BASE_URL: 'https://vision.example/v1',
    EMBEDDING_API_KEY: 'embed-key',
    EMBEDDING_BASE_URL: 'https://embed.example/v1',
  });

  const analysisModel = providers.llmAnalysis('claude-sonnet-4-20250514');
  const visionModel = providers.llmVision('claude-sonnet-4-20250514');
  const embeddingModel = providers.llmEmbedding.textEmbeddingModel('text-embedding-3-small');

  assert.equal(analysisModel.provider, 'anthropic.messages');
  assert.equal(visionModel.provider, 'anthropic.messages');
  assert.equal(embeddingModel.provider, 'openai.embedding');
});

test('createProviderFactories preserves the existing openai-compatible path for analysis, generation, vision, and embedding', () => {
  const providers = createProviderFactories({
    LLM_API_KEY: 'openai-key',
    LLM_BASE_URL: 'https://llm.example/v1',
    EMBEDDING_API_KEY: 'embed-key',
    EMBEDDING_BASE_URL: 'https://embed.example/v1',
  });

  const analysisModel = providers.llmAnalysis('gpt-4o');
  const generationModel = providers.llmGeneration('gpt-4o');
  const visionModel = providers.llmVision('gpt-4o');
  const embeddingModel = providers.llmEmbedding.textEmbeddingModel('text-embedding-3-small');

  assert.equal(analysisModel.provider, 'openai.responses');
  assert.equal(generationModel.provider, 'openai.responses');
  assert.equal(visionModel.provider, 'openai.responses');
  assert.equal(embeddingModel.provider, 'openai.embedding');
});

test('createProviderFactories raises a clear error when a language-model API key is missing', () => {
  const providers = createProviderFactories({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_BASE_URL: 'https://anthropic.example/v1',
  });

  assert.throws(
    () => providers.llmAnalysis('claude-sonnet-4-20250514'),
    /LLM provider API key is required/,
  );
});
