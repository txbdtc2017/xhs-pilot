import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGenerationCapabilityStatus } from './capability';

test('resolveGenerationCapabilityStatus rejects Kimi anthropic-messages generation', () => {
  const result = resolveGenerationCapabilityStatus({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_BASE_URL: 'https://api.kimi.com/coding/',
  });

  assert.deepEqual(result, {
    available: false,
    code: 'GENERATION_UNSUPPORTED_PROVIDER',
    message: '当前 Kimi Anthropic 配置暂不支持内容生成，请切换 provider 或启用兼容模式。',
  });
});

test('resolveGenerationCapabilityStatus allows openai-compatible generation', () => {
  const result = resolveGenerationCapabilityStatus({
    LLM_PROTOCOL: 'openai',
    LLM_BASE_URL: 'https://llm.example/v1',
  });

  assert.deepEqual(result, {
    available: true,
  });
});

test('resolveGenerationCapabilityStatus allows non-Kimi anthropic-messages generation', () => {
  const result = resolveGenerationCapabilityStatus({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_BASE_URL: 'https://api.anthropic.com/v1',
  });

  assert.deepEqual(result, {
    available: true,
  });
});
