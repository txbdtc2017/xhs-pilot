import assert from 'node:assert/strict';
import test from 'node:test';

import { createSamplesPostHandler } from './route';
import { InvalidManualTagsError, parseManualTagsFromFormData } from './manual-tags';

test('parseManualTagsFromFormData prefers manual_tags[] and normalizes values', () => {
  const formData = new FormData();
  formData.append('manual_tags[]', ' 职场 ');
  formData.append('manual_tags[]', '');
  formData.append('manual_tags[]', '效率');
  formData.append('manual_tags[]', '职场');

  assert.deepEqual(parseManualTagsFromFormData(formData), ['职场', '效率']);
});

test('parseManualTagsFromFormData supports legacy JSON string fallback', () => {
  const formData = new FormData();
  formData.append('manual_tags', '[" 复盘 ","效率","","复盘"]');

  assert.deepEqual(parseManualTagsFromFormData(formData), ['复盘', '效率']);
});

test('parseManualTagsFromFormData rejects invalid legacy JSON', () => {
  const formData = new FormData();
  formData.append('manual_tags', '{bad json}');

  assert.throws(
    () => parseManualTagsFromFormData(formData),
    (error: unknown) =>
      error instanceof InvalidManualTagsError &&
      error.message === 'manual_tags must be a JSON string array',
  );
});

test('POST /api/samples rejects unsupported image mime type before any persistence', async () => {
  let touchedPersistence = false;

  const POST = createSamplesPostHandler({
    getMaxUploadSizeBytes: () => 10 * 1024 * 1024,
    processIngestionText: (value) => value,
    parseManualTagsFromFormData,
    processIngestionImages: async () => {
      touchedPersistence = true;
      return [];
    },
    query: async () => {
      touchedPersistence = true;
      return [];
    },
    queryOne: async () => {
      touchedPersistence = true;
      return null;
    },
    listSamples: async () => ({ samples: [], total: 0 }),
    addAnalyzeJob: async () => {
      touchedPersistence = true;
    },
  });

  const formData = new FormData();
  formData.append('title', '测试标题');
  formData.append('body_text', '测试正文');
  formData.append(
    'images',
    new File([Buffer.from('fake-pdf')], 'cover.pdf', { type: 'application/pdf' }),
  );

  const response = await POST(new Request('http://localhost/api/samples', {
    method: 'POST',
    body: formData,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Only JPEG, PNG, and WebP images are allowed',
  });
  assert.equal(touchedPersistence, false);
});

test('POST /api/samples rejects image batches larger than nine files', async () => {
  const POST = createSamplesPostHandler({
    getMaxUploadSizeBytes: () => 10 * 1024 * 1024,
    processIngestionText: (value) => value,
    parseManualTagsFromFormData,
    processIngestionImages: async () => [],
    query: async () => [],
    queryOne: async () => null,
    listSamples: async () => ({ samples: [], total: 0 }),
    addAnalyzeJob: async () => undefined,
  });

  const formData = new FormData();
  formData.append('title', '测试标题');
  formData.append('body_text', '测试正文');

  for (let index = 0; index < 10; index += 1) {
    formData.append(
      'images',
      new File([Buffer.from(`image-${index}`)], `cover-${index}.png`, { type: 'image/png' }),
    );
  }

  const response = await POST(new Request('http://localhost/api/samples', {
    method: 'POST',
    body: formData,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'You can upload at most 9 images per sample',
  });
});

test('POST /api/samples rejects files larger than MAX_UPLOAD_SIZE_MB', async () => {
  const POST = createSamplesPostHandler({
    getMaxUploadSizeBytes: () => 4,
    processIngestionText: (value) => value,
    parseManualTagsFromFormData,
    processIngestionImages: async () => [],
    query: async () => [],
    queryOne: async () => null,
    listSamples: async () => ({ samples: [], total: 0 }),
    addAnalyzeJob: async () => undefined,
  });

  const formData = new FormData();
  formData.append('title', '测试标题');
  formData.append('body_text', '测试正文');
  formData.append(
    'images',
    new File([Buffer.from('12345')], 'cover.png', { type: 'image/png' }),
  );

  const response = await POST(new Request('http://localhost/api/samples', {
    method: 'POST',
    body: formData,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Each image must be smaller than 0.000004 MB',
  });
});
