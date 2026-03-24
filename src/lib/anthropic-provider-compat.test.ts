import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isKimiCodingAnthropicBaseUrl,
  normalizeAnthropicBaseUrl,
  resolveAnthropicCompatibleModelId,
  resolveAnthropicProviderHeaders,
} from './anthropic-provider-compat';

test('normalizeAnthropicBaseUrl appends /v1 exactly once', () => {
  assert.equal(normalizeAnthropicBaseUrl('https://api.anthropic.com'), 'https://api.anthropic.com/v1');
  assert.equal(normalizeAnthropicBaseUrl('https://api.anthropic.com/'), 'https://api.anthropic.com/v1');
  assert.equal(normalizeAnthropicBaseUrl('https://api.anthropic.com/v1'), 'https://api.anthropic.com/v1');
  assert.equal(normalizeAnthropicBaseUrl('https://api.anthropic.com/v1/'), 'https://api.anthropic.com/v1');
  assert.equal(normalizeAnthropicBaseUrl('https://api.kimi.com/coding/'), 'https://api.kimi.com/coding/v1');
  assert.equal(normalizeAnthropicBaseUrl(undefined), undefined);
});

test('isKimiCodingAnthropicBaseUrl recognizes Kimi coding roots with or without /v1', () => {
  assert.equal(isKimiCodingAnthropicBaseUrl('https://api.kimi.com/coding/'), true);
  assert.equal(isKimiCodingAnthropicBaseUrl('https://api.kimi.com/coding/v1'), true);
  assert.equal(isKimiCodingAnthropicBaseUrl('https://api.anthropic.com/v1'), false);
  assert.equal(isKimiCodingAnthropicBaseUrl(undefined), false);
});

test('resolveAnthropicProviderHeaders injects the Claude Code user agent for Kimi only', () => {
  assert.deepEqual(resolveAnthropicProviderHeaders('https://api.kimi.com/coding/'), {
    'User-Agent': 'claude-code/0.1.0',
  });
  assert.equal(resolveAnthropicProviderHeaders('https://api.anthropic.com/v1'), undefined);
});

test('resolveAnthropicCompatibleModelId remaps only the Kimi alias model id', () => {
  assert.equal(
    resolveAnthropicCompatibleModelId('kimi-code', 'https://api.kimi.com/coding/'),
    'kimi-for-coding',
  );
  assert.equal(resolveAnthropicCompatibleModelId('k2p5', 'https://api.kimi.com/coding/'), 'k2p5');
  assert.equal(
    resolveAnthropicCompatibleModelId('claude-sonnet-4-20250514', 'https://api.anthropic.com/v1'),
    'claude-sonnet-4-20250514',
  );
});
