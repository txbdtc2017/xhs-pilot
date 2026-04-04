import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildMissingEnvPatch, collectEnvKeys, syncEnvFiles } from './sync-env';

test('collectEnvKeys parses env assignment lines', () => {
  const keys = collectEnvKeys([
    '# comment',
    'LLM_API_KEY=sk-xxx',
    'IMAGE_MODEL=gpt-image-1',
  ].join('\n'));

  assert.deepEqual(Array.from(keys), ['LLM_API_KEY', 'IMAGE_MODEL']);
});

test('buildMissingEnvPatch includes comments only for missing keys', () => {
  const patch = buildMissingEnvPatch(
    [
      '# ===== 图片生成 =====',
      'IMAGE_PROTOCOL=openai',
      'IMAGE_MODEL=gpt-image-1',
      '',
      '# ===== Embedding =====',
      'EMBEDDING_MODEL=text-embedding-3-small',
    ].join('\n'),
    new Set(['IMAGE_PROTOCOL']),
  );

  assert.match(patch, /# ===== 图片生成 =====/);
  assert.doesNotMatch(patch, /IMAGE_PROTOCOL=openai/);
  assert.match(patch, /IMAGE_MODEL=gpt-image-1/);
  assert.match(patch, /EMBEDDING_MODEL=text-embedding-3-small/);
});

test('syncEnvFiles appends missing keys to the local env file without overwriting existing values', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'xhs-pilot-env-'));
  const examplePath = path.join(dir, '.env.example');
  const envPath = path.join(dir, '.env');

  writeFileSync(examplePath, [
    '# ===== 图片生成 =====',
    'IMAGE_PROTOCOL=openai',
    'IMAGE_MODEL=gpt-image-1',
    'IMAGE_GOOGLE_MODEL=gemini-3-pro-image-preview',
  ].join('\n'));
  writeFileSync(envPath, 'IMAGE_PROTOCOL=custom-openai\n');

  try {
    const result = syncEnvFiles(examplePath, envPath);
    const content = readFileSync(envPath, 'utf8');

    assert.equal(result.changed, true);
    assert.deepEqual(result.addedKeys, ['IMAGE_MODEL', 'IMAGE_GOOGLE_MODEL']);
    assert.match(content, /IMAGE_PROTOCOL=custom-openai/);
    assert.match(content, /IMAGE_MODEL=gpt-image-1/);
    assert.match(content, /IMAGE_GOOGLE_MODEL=gemini-3-pro-image-preview/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
