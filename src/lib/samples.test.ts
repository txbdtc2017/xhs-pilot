import assert from 'node:assert/strict';
import test from 'node:test';

import { buildListSamplesQuery, buildRelatedSamplesQuery } from './samples';

test('buildListSamplesQuery parameterizes all supported filters and pagination', () => {
  const built = buildListSamplesQuery({
    search: '复盘',
    track: '职场',
    contentType: '清单',
    coverStyle: '高对比大字',
    isHighValue: true,
    dateFrom: '2026-03-01',
    dateTo: '2026-03-31',
    page: 2,
    limit: 12,
  });

  assert.match(built.text, /sa\.track = \$1/);
  assert.match(built.text, /sa\.content_type = \$2/);
  assert.match(built.text, /sva\.cover_style_tag = \$3/);
  assert.match(built.text, /s\.is_high_value = \$4/);
  assert.match(built.text, /\(s\.title ILIKE \$5 OR s\.body_text ILIKE \$5\)/);
  assert.match(built.text, /s\.created_at >= \$6::date/);
  assert.match(built.text, /s\.created_at < \(\$7::date \+ INTERVAL '1 day'\)/);
  assert.match(built.text, /LIMIT \$8 OFFSET \$9/);
  assert.match(built.text, /COALESCE\(ref\.reference_count, 0\) AS reference_count/);
  assert.deepEqual(built.values, [
    '职场',
    '清单',
    '高对比大字',
    true,
    '%复盘%',
    '2026-03-01',
    '2026-03-31',
    12,
    12,
  ]);
});

test('buildListSamplesQuery falls back to defaults when filters are omitted', () => {
  const built = buildListSamplesQuery({
    page: 1,
    limit: 20,
  });

  assert.doesNotMatch(built.text, /sa\.track =/);
  assert.doesNotMatch(built.text, /sa\.content_type =/);
  assert.doesNotMatch(built.text, /sva\.cover_style_tag =/);
  assert.doesNotMatch(built.text, /s\.is_high_value =/);
  assert.doesNotMatch(built.text, /ILIKE/);
  assert.deepEqual(built.values, [20, 0]);
});

test('buildRelatedSamplesQuery excludes the current sample and orders by similarity', () => {
  const built = buildRelatedSamplesQuery({
    sampleId: 'sample-1',
    limit: 4,
  });

  assert.match(built.text, /current_embedding\.sample_id = \$1/);
  assert.match(built.text, /candidate\.sample_id <> \$1/);
  assert.match(built.text, /AS similarity/);
  assert.match(built.text, /ORDER BY similarity DESC/);
  assert.match(built.text, /LIMIT \$2/);
  assert.deepEqual(built.values, ['sample-1', 4]);
});
