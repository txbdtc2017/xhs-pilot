import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createSingleObjectStream,
  parseStructuredJsonText,
  shouldUseTextStructuredOutputFallback,
} from './structured-output';

test('shouldUseTextStructuredOutputFallback enables the text fallback for Kimi anthropic messages', () => {
  assert.equal(shouldUseTextStructuredOutputFallback({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_BASE_URL: 'https://api.kimi.com/coding/',
  }), true);

  assert.equal(shouldUseTextStructuredOutputFallback({
    LLM_PROTOCOL: 'openai',
    LLM_BASE_URL: 'https://api.kimi.com/coding/',
  }), false);

  assert.equal(shouldUseTextStructuredOutputFallback({
    LLM_PROTOCOL: 'anthropic-messages',
    LLM_BASE_URL: 'https://api.anthropic.com/v1',
  }), false);
});

test('parseStructuredJsonText extracts fenced JSON and validates it', async () => {
  const parsed = await parseStructuredJsonText(
    '```json\n{"ok":true,"label":"x"}\n```',
    (value): value is { ok: boolean; label: string } =>
      Boolean(value)
      && typeof value === 'object'
      && (value as Record<string, unknown>).ok === true
      && typeof (value as Record<string, unknown>).label === 'string',
    '测试对象',
  );

  assert.deepEqual(parsed, { ok: true, label: 'x' });
});

test('parseStructuredJsonText repairs truncated JSON before validating it', async () => {
  const parsed = await parseStructuredJsonText(
    '{"ok":true,"label":"x',
    (value): value is { ok: boolean; label: string } =>
      Boolean(value)
      && typeof value === 'object'
      && (value as Record<string, unknown>).ok === true
      && typeof (value as Record<string, unknown>).label === 'string',
    '测试对象',
  );

  assert.deepEqual(parsed, { ok: true, label: 'x' });
});

test('generateStructuredJsonText does not expose provider maxOutputTokens controls in production code', () => {
  const source = fs.readFileSync(new URL('./structured-output.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /maxOutputTokens/);
});

test('createSingleObjectStream yields the resolved object once', async () => {
  const stream = createSingleObjectStream(Promise.resolve({ status: 'ok' }));
  const snapshots: Array<Record<string, unknown>> = [];

  for await (const partial of stream.partialObjectStream) {
    snapshots.push(partial);
  }

  assert.deepEqual(snapshots, [{ status: 'ok' }]);
  assert.deepEqual(await stream.object, { status: 'ok' });
});
