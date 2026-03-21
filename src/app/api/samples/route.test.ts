import assert from 'node:assert/strict';
import test from 'node:test';

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
