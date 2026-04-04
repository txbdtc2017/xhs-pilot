import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildReferenceContextBlocks,
  retrieveTaskReferences,
  retrieveTaskReferencesFromUnderstanding,
  resolveReferenceMode,
  selectTaskReferences,
  understandTask,
  type StrategyDependencies,
  type TaskInput,
} from './strategy';
import type { TaskUnderstandingResult } from './schemas/task-understanding';

function createTaskInput(overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    topic: '写一篇让人想收藏的职场复盘笔记',
    targetAudience: '3-5年经验职场人',
    goal: '收藏',
    stylePreference: '专业直接',
    personaMode: 'balanced',
    ...overrides,
  };
}

function createTaskUnderstanding(
  overrides: Partial<TaskUnderstandingResult> = {},
): TaskUnderstandingResult {
  return {
    task_type: '干货',
    suitable_structure: '问题切入 + 3 点清单',
    reference_focus: ['标题', '结构'],
    notes: '避免空泛鸡汤',
    search_filters: {
      track: '职场',
      content_type: ['清单', '经验'],
      title_pattern_hints: ['数字型', '结果先行'],
    },
    rewritten_query: '职场干货清单 收藏导向 高互动',
    goal: '收藏',
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<StrategyDependencies> = {},
): StrategyDependencies {
  return {
    generateTaskUnderstanding: async () => createTaskUnderstanding(),
    createTaskEmbedding: async () => [0.12, 0.34],
    searchSimilarSamples: async () => [],
    searchLexicalSamples: async () => [],
    getSearchModeStatus: () => ({
      searchMode: 'hybrid',
      searchModeReason: null,
      embeddingModel: 'text-embedding-3-small',
    }),
    ...overrides,
  };
}

test('understandTask builds the prompt from user task input and returns structured output', async () => {
  const calls: Array<{ system: string; prompt: string }> = [];

  const result = await understandTask(createTaskInput(), createDependencies({
    generateTaskUnderstanding: async ({ system, prompt }) => {
      calls.push({ system, prompt });
      return createTaskUnderstanding();
    },
  }));

  assert.equal(calls.length, 1);
  assert.match(calls[0].system, /小红书内容策略师/);
  assert.match(calls[0].prompt, /主题：写一篇让人想收藏的职场复盘笔记/);
  assert.match(calls[0].prompt, /目标效果：收藏/);
  assert.equal('is_reference_allowed' in result.search_filters, false);
  assert.equal(result.rewritten_query, '职场干货清单 收藏导向 高互动');
});

test('retrieveTaskReferences embeds the rewritten query before searching and injects system filters', async () => {
  const steps: string[] = [];
  const taskUnderstanding = createTaskUnderstanding();

  const result = await retrieveTaskReferences(createTaskInput(), createDependencies({
    generateTaskUnderstanding: async () => {
      steps.push('understand');
      return taskUnderstanding;
    },
    createTaskEmbedding: async (query) => {
      steps.push(`embed:${query}`);
      return [0.91, 0.82];
    },
    searchSimilarSamples: async (params) => {
      steps.push('search');
      assert.deepEqual(params.taskEmbedding, [0.91, 0.82]);
      assert.deepEqual(params.filters, {
        track: '职场',
        content_type: ['清单', '经验'],
        title_pattern_hints: ['数字型', '结果先行'],
        is_reference_allowed: true,
      });
      assert.equal(params.similarityThreshold, 0);
      return [
        {
          sample_id: 'sample-1',
          title: '升职前一定要学会的复盘框架',
          similarity: 0.88,
          track: '职场',
          content_type: '清单',
          reasoning_summary: '命中职场复盘主题',
          title_pattern_explanation: '结果先行',
          opening_explanation: '痛点切入',
          structure_explanation: '三点清单',
          cover_explanation: '高对比大字',
        },
      ];
    },
  }));

  assert.deepEqual(steps, [
    'understand',
    'embed:职场干货清单 收藏导向 高互动',
    'search',
  ]);
  assert.equal(result.referenceMode, 'referenced');
  assert.deepEqual(result.taskEmbedding, [0.91, 0.82]);
  assert.equal(result.similarSamples.length, 1);
});

test('retrieveTaskReferencesFromUnderstanding reuses an existing understanding result', async () => {
  const taskUnderstanding = createTaskUnderstanding({
    rewritten_query: '复盘清单 收藏导向',
  });

  let understandCalls = 0;
  const result = await retrieveTaskReferencesFromUnderstanding(
    taskUnderstanding,
    createDependencies({
      generateTaskUnderstanding: async () => {
        understandCalls += 1;
        return taskUnderstanding;
      },
      createTaskEmbedding: async (query) => {
        assert.equal(query, '复盘清单 收藏导向');
        return [0.21, 0.43];
      },
      searchSimilarSamples: async () => [],
    }),
  );

  assert.equal(understandCalls, 0);
  assert.deepEqual(result.taskUnderstanding, taskUnderstanding);
  assert.deepEqual(result.taskEmbedding, [0.21, 0.43]);
  assert.equal(result.referenceMode, 'zero-shot');
});

test('retrieveTaskReferences skips embeddings and uses lexical candidates when no embedding provider is configured', async () => {
  const originalEmbeddingApiKey = process.env.EMBEDDING_API_KEY;
  const originalEmbeddingBaseUrl = process.env.EMBEDDING_BASE_URL;
  const originalEmbeddingModel = process.env.EMBEDDING_MODEL;

  delete process.env.EMBEDDING_API_KEY;
  delete process.env.EMBEDDING_BASE_URL;
  delete process.env.EMBEDDING_MODEL;

  try {
    const taskUnderstanding = createTaskUnderstanding({
      rewritten_query: '职场 复盘 清单 收藏导向',
    });
    const steps: string[] = [];

    const dependencies: StrategyDependencies = {
      generateTaskUnderstanding: async () => {
        steps.push('understand');
        return taskUnderstanding;
      },
      createTaskEmbedding: async () => {
        steps.push('embed');
        throw new Error('embedding should not be called');
      },
      searchSimilarSamples: async () => {
        steps.push('vector');
        throw new Error('vector search should not be called');
      },
      searchLexicalSamples: async (params) => {
        steps.push('lexical');
        assert.equal(params.query, '职场 复盘 清单 收藏导向');
        assert.equal(params.topic, '写一篇让人想收藏的职场复盘笔记');
        assert.deepEqual(params.filters, {
          track: '职场',
          content_type: ['清单', '经验'],
          title_pattern_hints: ['数字型', '结果先行'],
          is_reference_allowed: true,
        });

        return [
          ...Array.from({ length: 5 }, (_, index) => ({
            sample_id: `sample-lexical-${index + 1}`,
            title: `职场复盘清单样本 ${index + 1}`,
            similarity: 0.74 - index * 0.02,
            track: '职场',
            content_type: '清单',
            reasoning_summary: '命中职场复盘主题',
            title_pattern_explanation: '结果先行',
            opening_explanation: '痛点切入',
            structure_explanation: '三点清单',
            cover_explanation: '高对比大字',
          })),
        ];
      },
      getSearchModeStatus: () => ({
        searchMode: 'lexical-only',
        searchModeReason: 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。',
        embeddingModel: 'text-embedding-3-small',
      }),
    };

    const result = await retrieveTaskReferences(createTaskInput(), dependencies);

    assert.deepEqual(steps, ['understand', 'lexical']);
    assert.equal((result as { searchMode?: string }).searchMode, 'lexical-only');
    assert.deepEqual(result.taskEmbedding, []);
    assert.equal(result.referenceMode, 'referenced');
    assert.equal(result.similarSamples[0]?.sample_id, 'sample-lexical-1');
  } finally {
    process.env.EMBEDDING_API_KEY = originalEmbeddingApiKey;
    process.env.EMBEDDING_BASE_URL = originalEmbeddingBaseUrl;
    process.env.EMBEDDING_MODEL = originalEmbeddingModel;
  }
});

test('selectTaskReferences allocates references by dimension when similar samples are available', () => {
  const taskUnderstanding = createTaskUnderstanding({
    reference_focus: ['标题', '结构', '视觉', '语气'],
  });

  const result = selectTaskReferences(
    [
      {
        sample_id: 'sample-1',
        title: '标题一',
        similarity: 0.94,
        track: '职场',
        content_type: '清单',
        reasoning_summary: '语气偏专业克制',
        title_pattern_explanation: '标题突出结果收益',
        opening_explanation: '开头先给痛点',
        structure_explanation: '三段清单结构',
        cover_explanation: '高对比大字',
      },
      {
        sample_id: 'sample-2',
        title: '标题二',
        similarity: 0.9,
        track: '职场',
        content_type: '经验',
        reasoning_summary: '语气偏直接',
        title_pattern_explanation: '数字型标题',
        opening_explanation: '结果前置开头',
        structure_explanation: '五点清单结构',
        cover_explanation: '封面强调结论',
      },
      {
        sample_id: 'sample-3',
        title: '标题三',
        similarity: 0.86,
        track: '职场',
        content_type: '经验',
        reasoning_summary: '语气有压迫感',
        title_pattern_explanation: null,
        opening_explanation: '场景切入',
        structure_explanation: '问题-拆解-总结',
        cover_explanation: null,
      },
      {
        sample_id: 'sample-4',
        title: '标题四',
        similarity: 0.81,
        track: '职场',
        content_type: '观点',
        reasoning_summary: '语气偏复盘总结',
        title_pattern_explanation: null,
        opening_explanation: null,
        structure_explanation: '总分总结构',
        cover_explanation: null,
      },
    ],
    taskUnderstanding,
    'referenced',
  );

  assert.equal(result.reference_mode, 'referenced');
  assert.equal(result.candidate_count, 4);
  assert.equal(
    result.selected_references.filter((item) => item.reference_type === 'title').length,
    2,
  );
  assert.equal(
    result.selected_references.filter((item) => item.reference_type === 'structure').length,
    3,
  );
  assert.equal(
    result.selected_references.filter((item) => item.reference_type === 'visual').length,
    1,
  );
  assert.equal(
    result.selected_references.filter((item) => item.reference_type === 'tone').length,
    1,
  );
});

test('selectTaskReferences returns no selections in zero-shot mode', () => {
  const result = selectTaskReferences(
    [
      {
        sample_id: 'sample-1',
        title: '标题一',
        similarity: 0.42,
        track: '职场',
        content_type: '清单',
        reasoning_summary: 'fallback',
        title_pattern_explanation: '标题',
        opening_explanation: '开头',
        structure_explanation: '结构',
        cover_explanation: '封面',
      },
    ],
    createTaskUnderstanding(),
    'zero-shot',
  );

  assert.deepEqual(result.selected_references, []);
  assert.equal(result.reference_mode, 'zero-shot');
  assert.equal(result.candidate_count, 1);
});

test('buildReferenceContextBlocks only injects fields required for each reference type', () => {
  const selectedReferences = [
    {
      sample_id: 'sample-title',
      title: '标题样本',
      similarity: 0.91,
      reference_type: 'title' as const,
      reason: '标题节奏可复用',
    },
    {
      sample_id: 'sample-structure',
      title: '结构样本',
      similarity: 0.87,
      reference_type: 'structure' as const,
      reason: '结构拆解清晰',
    },
    {
      sample_id: 'sample-visual',
      title: '封面样本',
      similarity: 0.85,
      reference_type: 'visual' as const,
      reason: '封面结论直接',
    },
    {
      sample_id: 'sample-tone',
      title: '语气样本',
      similarity: 0.82,
      reference_type: 'tone' as const,
      reason: '语气专业克制',
    },
  ];

  const blocks = buildReferenceContextBlocks(
    selectedReferences,
    [
      {
        sample_id: 'sample-title',
        title: '标题样本',
        similarity: 0.91,
        track: '职场',
        content_type: '清单',
        reasoning_summary: '这段不应出现在标题参考里',
        title_pattern_explanation: '标题解释',
        opening_explanation: '开头解释',
        structure_explanation: '结构解释',
        cover_explanation: '封面解释',
      },
      {
        sample_id: 'sample-structure',
        title: '结构样本',
        similarity: 0.87,
        track: '职场',
        content_type: '经验',
        reasoning_summary: '语气摘要',
        title_pattern_explanation: '标题解释',
        opening_explanation: '开头解释',
        structure_explanation: '结构解释',
        cover_explanation: '封面解释',
      },
      {
        sample_id: 'sample-visual',
        title: '封面样本',
        similarity: 0.85,
        track: '职场',
        content_type: '经验',
        reasoning_summary: '语气摘要',
        title_pattern_explanation: '标题解释',
        opening_explanation: '开头解释',
        structure_explanation: '结构解释',
        cover_explanation: '封面解释',
      },
      {
        sample_id: 'sample-tone',
        title: '语气样本',
        similarity: 0.82,
        track: '职场',
        content_type: '观点',
        reasoning_summary: '语气摘要',
        title_pattern_explanation: '标题解释',
        opening_explanation: '开头解释',
        structure_explanation: '结构解释',
        cover_explanation: '封面解释',
      },
    ],
  );

  assert.equal(blocks.length, 4);
  assert.match(blocks[0].promptBlock, /原标题：标题样本/);
  assert.match(blocks[0].promptBlock, /标题模式解读：标题解释/);
  assert.doesNotMatch(blocks[0].promptBlock, /结构解释/);

  assert.match(blocks[1].promptBlock, /结构解读：结构解释/);
  assert.match(blocks[1].promptBlock, /开头解读：开头解释/);
  assert.doesNotMatch(blocks[1].promptBlock, /封面解释/);

  assert.match(blocks[2].promptBlock, /封面表达解读：封面解释/);
  assert.doesNotMatch(blocks[2].promptBlock, /语气摘要/);

  assert.match(blocks[3].promptBlock, /原标题：语气样本/);
  assert.match(blocks[3].promptBlock, /语气摘要：语气摘要/);
  assert.doesNotMatch(blocks[3].promptBlock, /结构解释/);
});

test('resolveReferenceMode distinguishes empty, low-similarity, and matched results', () => {
  assert.equal(resolveReferenceMode([], 0.6), 'zero-shot');
  assert.equal(
    resolveReferenceMode([
      {
        sample_id: 'sample-low',
        title: '低相似样本',
        similarity: 0.42,
        track: '职场',
        content_type: '清单',
        reasoning_summary: null,
        title_pattern_explanation: null,
        opening_explanation: null,
        structure_explanation: null,
        cover_explanation: null,
      },
    ], 0.6),
    'zero-shot',
  );
  assert.equal(
    resolveReferenceMode([
      {
        sample_id: 'sample-high',
        title: '高相似样本',
        similarity: 0.73,
        track: '职场',
        content_type: '清单',
        reasoning_summary: null,
        title_pattern_explanation: null,
        opening_explanation: null,
        structure_explanation: null,
        cover_explanation: null,
      },
    ], 0.6),
    'referenced',
  );
});

test('Kimi structured output fallback does not hardcode local maxOutputTokens caps', () => {
  const source = fs.readFileSync(new URL('./strategy.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /maxOutputTokens:\s*\d+/);
});
