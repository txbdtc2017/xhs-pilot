import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTypicalTags } from './style-profiles';

test('buildTypicalTags returns the most frequent track, content type, and cover labels', () => {
  const typicalTags = buildTypicalTags([
    { track: '职场', content_type: '清单', cover_style_tag: '高对比大字' },
    { track: '职场', content_type: '清单', cover_style_tag: '高对比大字' },
    { track: '效率', content_type: '教程', cover_style_tag: '极简' },
    { track: '职场', content_type: '教程', cover_style_tag: '高对比大字' },
    { track: null, content_type: null, cover_style_tag: null },
  ]);

  assert.deepEqual(typicalTags, ['职场', '高对比大字', '清单', '教程', '效率', '极简']);
});

test('buildTypicalTags returns an empty list when no labels exist', () => {
  assert.deepEqual(
    buildTypicalTags([
      { track: null, content_type: null, cover_style_tag: null },
    ]),
    [],
  );
});
