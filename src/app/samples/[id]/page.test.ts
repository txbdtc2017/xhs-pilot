import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as sampleDetailPageModule from './page';

test('sample detail content shows restore actions for deleted samples', () => {
  assert.equal(typeof sampleDetailPageModule.SampleDetailPageContent, 'function');

  const html = renderToStaticMarkup(
    createElement(sampleDetailPageModule.SampleDetailPageContent, {
      id: 'sample-1',
      detail: {
        sample: {
          id: 'sample-1',
          title: '已删除样本',
          body_text: '正文内容',
          source_url: '',
          manual_notes: '',
          manual_tags: [],
          status: 'completed',
          is_high_value: false,
          is_reference_allowed: true,
          deleted_at: '2026-03-23T08:00:00.000Z',
        },
        analysis: null,
        visualAnalysis: null,
        images: [],
        related_samples: [],
        referenced_by_tasks: [],
        style_profiles: [],
      },
      statusRefreshControl: null,
    }),
  );

  assert.match(html, /恢复/);
  assert.match(html, /彻底删除/);
  assert.doesNotMatch(html, /移入回收站/);
  assert.match(html, /样本档案/);
  assert.match(html, /页面导航/);
});
