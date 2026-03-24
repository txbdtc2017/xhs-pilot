import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as samplesPageModule from './page';

const sampleListItem = {
  id: 'sample-1',
  title: '样本标题',
  status: 'completed',
  track: '职场',
  content_type: '清单',
  cover_style_tag: '高对比大字',
  is_high_value: false,
  reference_count: 2,
  cover_url: null,
  created_at: '2026-03-20T00:00:00.000Z',
};

test('samples page content shows ingest entry and trash action for active samples', () => {
  assert.equal(typeof samplesPageModule.SamplesPageContent, 'function');

  const html = renderToStaticMarkup(
    createElement(samplesPageModule.SamplesPageContent, {
      query: {},
      currentPage: 1,
      totalPages: 1,
      filters: {
        view: 'active',
        search: '',
        track: '',
        contentType: '',
        coverStyle: '',
        isHighValue: '',
        dateFrom: '',
        dateTo: '',
      },
      options: {
        tracks: ['职场'],
        contentTypes: ['清单'],
        coverStyles: ['高对比大字'],
      },
      ingestControl: createElement('button', { className: 'buttonPrimary', type: 'button' }, '录入样本'),
      statusRefreshControl: null,
      result: {
        samples: [sampleListItem],
        total: 1,
      },
      hasActiveSamples: false,
    }),
  );

  assert.match(html, /录入样本/);
  assert.match(html, /移入回收站/);
  assert.match(html, /样本库/);
});

test('samples page content hides ingest entry and shows restore actions in trash view', () => {
  assert.equal(typeof samplesPageModule.SamplesPageContent, 'function');

  const html = renderToStaticMarkup(
    createElement(samplesPageModule.SamplesPageContent, {
      query: { view: 'trash' },
      currentPage: 1,
      totalPages: 1,
      filters: {
        view: 'trash',
        search: '',
        track: '',
        contentType: '',
        coverStyle: '',
        isHighValue: '',
        dateFrom: '',
        dateTo: '',
      },
      options: {
        tracks: [],
        contentTypes: [],
        coverStyles: [],
      },
      ingestControl: createElement('button', { className: 'buttonPrimary', type: 'button' }, '录入样本'),
      statusRefreshControl: null,
      result: {
        samples: [sampleListItem],
        total: 1,
      },
      hasActiveSamples: false,
    }),
  );

  assert.match(html, /回收站/);
  assert.match(html, /恢复/);
  assert.match(html, /彻底删除/);
  assert.doesNotMatch(html, /录入样本/);
});
