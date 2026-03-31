import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as stylesPageModule from './page';

test('style profiles page content presents the curated collection framing', () => {
  assert.equal(typeof stylesPageModule.StyleProfilesPageContent, 'function');

  const html = renderToStaticMarkup(
    createElement(stylesPageModule.StyleProfilesPageContent, {
      profiles: [
        {
          id: 'profile-1',
          name: '职场清单收藏风',
          description: '适合收藏向职场清单内容。',
          sample_count: 3,
          typical_tags: ['高对比大字', '结果先行'],
        },
      ],
    }),
  );

  assert.match(html, /风格画像/);
  assert.match(html, /职场清单收藏风/);
  assert.doesNotMatch(html, /风格索引|人工策展台/);
});
