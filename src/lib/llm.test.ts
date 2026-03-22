import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveProviderOptions } from './llm';

test('resolveProviderOptions falls back to the base LLM provider for vision when VISION_* is unset', () => {
  const resolved = resolveProviderOptions({
    LLM_API_KEY: 'main-key',
    LLM_BASE_URL: 'https://llm.example/v1',
  });

  assert.deepEqual(resolved.vision, {
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
    apiKey: 'vision-key',
    baseURL: 'https://vision.example/v1',
  });
});
