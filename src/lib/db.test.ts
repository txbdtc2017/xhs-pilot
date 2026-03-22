import assert from 'node:assert/strict';
import test from 'node:test';

import * as db from './db';

test('serializeVectorForPg formats embeddings as pgvector literals', () => {
  assert.equal(db.serializeVectorForPg([0.1, 2, -0.35]), '[0.1,2,-0.35]');
});

test('buildSearchSimilarSamplesQuery parameterizes structured filters and similarity threshold', () => {
  const query = db.buildSearchSimilarSamplesQuery({
    taskEmbedding: [0.1, 0.2],
    filters: {
      track: '职场',
      content_type: ['清单', '经验'],
      title_pattern_hints: ['数字型', '结果先行'],
      is_reference_allowed: true,
    },
    limit: 5,
    similarityThreshold: 0.4,
  });

  assert.match(query.text, /LEAST\(1, GREATEST\(0, 1 - \(se\.embedding <=> \$1::vector\)\)\) AS similarity/);
  assert.match(query.text, /s\.is_reference_allowed = \$2/);
  assert.match(query.text, /sa\.track = \$3/);
  assert.match(query.text, /sa\.content_type = ANY\(\$4::text\[\]\)/);
  assert.match(query.text, /sa\.title_pattern_tags && \$5::text\[\]/);
  assert.match(query.text, />= \$6/);
  assert.match(query.text, /LIMIT \$7/);
  assert.match(query.text, /ORDER BY se\.embedding <=> \$1::vector ASC/);
  assert.deepEqual(query.values, [
    '[0.1,0.2]',
    true,
    '职场',
    ['清单', '经验'],
    ['数字型', '结果先行'],
    0.4,
    5,
  ]);
});

test('buildSearchSimilarSamplesQuery falls back to default threshold and limit when optional filters are omitted', () => {
  const query = db.buildSearchSimilarSamplesQuery({
    taskEmbedding: [0.3, 0.4],
    filters: {},
  });

  assert.equal(query.values[0], '[0.3,0.4]');
  assert.equal(query.values.at(-2), 0.6);
  assert.equal(query.values.at(-1), 20);
  assert.doesNotMatch(query.text, /sa\.track =/);
  assert.doesNotMatch(query.text, /sa\.content_type = ANY/);
  assert.doesNotMatch(query.text, /sa\.title_pattern_tags &&/);
});

test('db exports a lexical search query builder for lexical-only mode', () => {
  assert.equal(typeof (db as Record<string, unknown>).buildSearchLexicalSamplesQuery, 'function');
});
