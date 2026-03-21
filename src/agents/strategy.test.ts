import assert from 'node:assert/strict';
import test from 'node:test';

import {
  retrieveTaskReferences,
  resolveReferenceMode,
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
