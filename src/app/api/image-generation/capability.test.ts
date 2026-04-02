import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  listImageGenerationProviders,
  resolveImageGenerationCapabilityStatus,
} from './capability';

function createGoogleCredentialFile(contents: Record<string, unknown>): { dir: string; filePath: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'xhs-pilot-google-'));
  const filePath = path.join(dir, 'service-account.json');
  writeFileSync(filePath, JSON.stringify(contents), 'utf8');
  return { dir, filePath };
}

test('resolveImageGenerationCapabilityStatus reports IMAGE_UNCONFIGURED when OpenAI IMAGE_* is missing', () => {
  const result = resolveImageGenerationCapabilityStatus(
    {
      IMAGE_PROTOCOL: 'openai',
      IMAGE_API_KEY: 'image-key',
      IMAGE_BASE_URL: '',
      IMAGE_MODEL: 'gpt-image-1',
    },
    'openai',
  );

  assert.deepEqual(result, {
    provider: 'openai',
    available: false,
    code: 'IMAGE_UNCONFIGURED',
    message: '当前未配置图片生成能力，请补充 IMAGE_* 配置。',
    model: 'gpt-image-1',
  });
});

test('resolveImageGenerationCapabilityStatus rejects unsupported OpenAI image protocols', () => {
  const result = resolveImageGenerationCapabilityStatus(
    {
      IMAGE_PROTOCOL: 'anthropic-messages',
      IMAGE_API_KEY: 'image-key',
      IMAGE_BASE_URL: 'https://image.example/v1',
      IMAGE_MODEL: 'gpt-image-1',
    },
    'openai',
  );

  assert.deepEqual(result, {
    provider: 'openai',
    available: false,
    code: 'IMAGE_UNSUPPORTED_PROTOCOL',
    message: '当前图片生成仅支持 openai 协议。',
    model: 'gpt-image-1',
  });
});

test('resolveImageGenerationCapabilityStatus allows explicitly configured openai image generation', () => {
  const result = resolveImageGenerationCapabilityStatus(
    {
      IMAGE_PROTOCOL: 'openai',
      IMAGE_API_KEY: 'image-key',
      IMAGE_BASE_URL: 'https://image.example/v1',
      IMAGE_MODEL: 'gpt-image-1',
    },
    'openai',
  );

  assert.deepEqual(result, {
    provider: 'openai',
    available: true,
    model: 'gpt-image-1',
  });
});

test('resolveImageGenerationCapabilityStatus validates Google Vertex Banana credentials and defaults', () => {
  const { dir, filePath } = createGoogleCredentialFile({
    type: 'service_account',
    project_id: 'banana-project',
    client_email: 'banana@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  });

  try {
    const result = resolveImageGenerationCapabilityStatus(
      {
        IMAGE_GOOGLE_CREDENTIALS_PATH: filePath,
      },
      'google_vertex',
    );

    assert.deepEqual(result, {
      provider: 'google_vertex',
      available: true,
      model: 'gemini-3-pro-image-preview',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveImageGenerationCapabilityStatus reports invalid Google credential files', () => {
  const { dir, filePath } = createGoogleCredentialFile({
    type: 'authorized_user',
    project_id: 'banana-project',
  });

  try {
    const result = resolveImageGenerationCapabilityStatus(
      {
        IMAGE_GOOGLE_CREDENTIALS_PATH: filePath,
        IMAGE_GOOGLE_MODEL: 'gemini-3-pro-image-preview',
      },
      'google_vertex',
    );

    assert.deepEqual(result, {
      provider: 'google_vertex',
      available: false,
      code: 'IMAGE_GOOGLE_INVALID_CREDENTIALS',
      message: `当前 Google Banana 凭证无效：${filePath} 必须是 service account JSON。`,
      model: 'gemini-3-pro-image-preview',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listImageGenerationProviders returns availability per provider and prefers openai as default', () => {
  const { dir, filePath } = createGoogleCredentialFile({
    type: 'service_account',
    project_id: 'banana-project',
  });

  try {
    const result = listImageGenerationProviders({
      IMAGE_PROTOCOL: 'openai',
      IMAGE_API_KEY: 'image-key',
      IMAGE_BASE_URL: 'https://image.example/v1',
      IMAGE_MODEL: 'gpt-image-1',
      IMAGE_GOOGLE_CREDENTIALS_PATH: filePath,
      IMAGE_GOOGLE_MODEL: 'gemini-3-pro-image-preview',
    });

    assert.equal(result.defaultProvider, 'openai');
    assert.deepEqual(
      result.providers.map((provider) => ({
        provider: provider.provider,
        available: provider.available,
        model: provider.model,
      })),
      [
        { provider: 'openai', available: true, model: 'gpt-image-1' },
        { provider: 'google_vertex', available: true, model: 'gemini-3-pro-image-preview' },
      ],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listImageGenerationProviders falls back to google_vertex when openai is unavailable', () => {
  const { dir, filePath } = createGoogleCredentialFile({
    type: 'service_account',
    project_id: 'banana-project',
  });

  try {
    const result = listImageGenerationProviders({
      IMAGE_GOOGLE_CREDENTIALS_PATH: filePath,
    });

    assert.equal(result.defaultProvider, 'google_vertex');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listImageGenerationProviders returns no default when every provider is unavailable', () => {
  const result = listImageGenerationProviders({
    IMAGE_PROTOCOL: 'openai',
    IMAGE_API_KEY: '',
    IMAGE_BASE_URL: '',
  });

  assert.equal(result.defaultProvider, null);
});
