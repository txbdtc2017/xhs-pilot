import assert from 'node:assert/strict';
import test from 'node:test';

import { createSseParser } from '@/lib/sse';
import { createGeneratePostHandler } from './route';

function createTaskUnderstanding() {
  return {
    task_type: '干货' as const,
    suitable_structure: '痛点切入 + 三点清单',
    reference_focus: ['标题', '结构'] as const,
    notes: '避免空泛表达',
    search_filters: {
      track: '职场',
      content_type: ['清单'],
      title_pattern_hints: ['结果先行'],
    },
    rewritten_query: '职场复盘 清单 收藏导向',
    goal: '收藏' as const,
  };
}

function createStrategyResult() {
  return {
    content_direction: '干货' as const,
    title_strategy: '参考 sample-1 的结果先行标题节奏',
    opening_strategy: '先抛出常见复盘误区',
    structure_strategy: '三点清单结构',
    cover_strategy: '大字结论封面',
    cta_strategy: '结尾引导收藏',
    warnings: ['不要写成流水账'],
    strategy_summary: '做成高密度复盘清单',
  };
}

function createGenerationTemplate() {
  return `## 标题候选
1. 标题一
2. 标题二
3. 标题三
4. 标题四
5. 标题五

## 开头候选
1. 开头一
2. 开头二
3. 开头三

## 正文
正文内容

## CTA 候选
1. CTA 一
2. CTA 二

## 封面文案
1. 主标题：封面主一
   副标题：封面副一
2. 主标题：封面主二
   副标题：封面副二

## 标签建议
#标签一
#标签二

## 首评建议
首评内容

## 配图建议
配图建议`;
}

async function readSseEvents(response: Response) {
  const text = await response.text();
  const events: Array<{ event: string; data: unknown }> = [];
  const parser = createSseParser((event) => {
    events.push(event);
  });

  parser.push(text);
  parser.flush();

  return events;
}

function createAsyncIterable<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield value;
      }
    },
  };
}

test('POST /api/generate streams understanding, references, strategy, generation, and done events', async () => {
  const statusUpdates: Array<{ taskId: string; status: string; referenceMode?: string }> = [];
  const saved: Record<string, unknown> = {};
  const taskUnderstanding = createTaskUnderstanding();
  const strategy = createStrategyResult();

  const POST = createGeneratePostHandler({
    createTask: async () => ({ id: 'task-1' }),
    updateTask: async (taskId, patch) => {
      statusUpdates.push({ taskId, status: patch.status, referenceMode: patch.referenceMode });
    },
    saveTaskReferences: async (_taskId, selection) => {
      saved.references = selection;
    },
    saveTaskStrategy: async (_taskId, result) => {
      saved.strategy = result;
    },
    saveTaskOutputs: async (_taskId, outputs) => {
      saved.outputs = outputs;
    },
    understandTask: async () => taskUnderstanding,
    retrieveTaskReferencesFromUnderstanding: async () => ({
      searchMode: 'hybrid' as const,
      searchModeReason: null,
      referenceMode: 'referenced' as const,
      similarSamples: [
        {
          sample_id: 'sample-1',
          title: '参考标题',
          similarity: 0.91,
          track: '职场',
          content_type: '清单',
          reasoning_summary: '专业总结语气',
          title_pattern_explanation: '结果先行标题',
          opening_explanation: '痛点切入',
          structure_explanation: '三点清单',
          cover_explanation: '结论大字',
        },
      ],
      taskUnderstanding,
      taskEmbedding: [0.1, 0.2],
    }),
    startStrategyStream: async () => ({
      partialObjectStream: createAsyncIterable([
        { content_direction: '干货' },
        strategy,
      ]),
      object: Promise.resolve(strategy),
    }),
    startGenerationStream: async () => ({
      textStream: createAsyncIterable([
        createGenerationTemplate().slice(0, 80),
        createGenerationTemplate().slice(80),
      ]),
    }),
  });

  const response = await POST(new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '写一篇让人想收藏的复盘笔记' }),
  }));

  assert.equal(response.headers.get('Content-Type'), 'text/event-stream');

  const events = await readSseEvents(response);
  assert.deepEqual(events.map((event) => event.event), [
    'task_understanding',
    'references',
    'strategy_snapshot',
    'strategy_snapshot',
    'generation_delta',
    'generation_delta',
    'generation_complete',
    'done',
  ]);

  assert.deepEqual(statusUpdates, [
    { taskId: 'task-1', status: 'understanding', referenceMode: undefined },
    { taskId: 'task-1', status: 'searching', referenceMode: undefined },
    { taskId: 'task-1', status: 'strategizing', referenceMode: undefined },
    { taskId: 'task-1', status: 'generating', referenceMode: undefined },
    { taskId: 'task-1', status: 'completed', referenceMode: 'referenced' },
  ]);

  assert.deepEqual(saved.strategy, strategy);
  assert.ok(saved.references);
  assert.ok(saved.outputs);

  const referencesEvent = events.find((event) => event.event === 'references');
  assert.deepEqual(referencesEvent?.data, {
    search_mode: 'hybrid',
    search_mode_reason: null,
    reference_mode: 'referenced',
    candidate_count: 1,
    selected_references: [
      {
        sample_id: 'sample-1',
        title: '参考标题',
        similarity: 0.91,
        reference_type: 'title',
        reason: '标题模式说明完整，适合提供标题节奏参考',
      },
      {
        sample_id: 'sample-1',
        title: '参考标题',
        similarity: 0.91,
        reference_type: 'structure',
        reason: '结构拆解信息完整，适合提供段落与开头组织参考',
      },
      {
        sample_id: 'sample-1',
        title: '参考标题',
        similarity: 0.91,
        reference_type: 'visual',
        reason: '封面表达摘要完整，适合提供封面表达参考',
      },
      {
        sample_id: 'sample-1',
        title: '参考标题',
        similarity: 0.91,
        reference_type: 'tone',
        reason: '综合语气摘要明确，适合提供语气参考',
      },
    ],
  });
});

test('POST /api/generate rejects unsupported Kimi anthropic generation before task creation', async () => {
  const originalProtocol = process.env.LLM_PROTOCOL;
  const originalBaseUrl = process.env.LLM_BASE_URL;
  let createTaskCalled = false;

  process.env.LLM_PROTOCOL = 'anthropic-messages';
  process.env.LLM_BASE_URL = 'https://api.kimi.com/coding/';

  try {
    const POST = createGeneratePostHandler({
      createTask: async () => {
        createTaskCalled = true;
        return { id: 'task-unsupported' };
      },
      updateTask: async () => {},
      saveTaskReferences: async () => {},
      saveTaskStrategy: async () => {},
      saveTaskOutputs: async () => {},
      understandTask: async () => createTaskUnderstanding(),
      retrieveTaskReferencesFromUnderstanding: async () => ({
        searchMode: 'hybrid' as const,
        searchModeReason: null,
        referenceMode: 'referenced' as const,
        similarSamples: [],
        taskUnderstanding: createTaskUnderstanding(),
        taskEmbedding: [],
      }),
      startStrategyStream: async () => ({
        partialObjectStream: createAsyncIterable([createStrategyResult()]),
        object: Promise.resolve(createStrategyResult()),
      }),
      startGenerationStream: async () => ({
        textStream: createAsyncIterable([createGenerationTemplate()]),
      }),
    });

    const response = await POST(new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: '不兼容配置任务' }),
    }));

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: '当前 Kimi Anthropic 配置暂不支持内容生成，请切换 provider 或启用兼容模式。',
      code: 'GENERATION_UNSUPPORTED_PROVIDER',
    });
    assert.equal(createTaskCalled, false);
  } finally {
    process.env.LLM_PROTOCOL = originalProtocol;
    process.env.LLM_BASE_URL = originalBaseUrl;
  }
});

test('POST /api/generate emits zero-shot references when retrieval falls back', async () => {
  const POST = createGeneratePostHandler({
    createTask: async () => ({ id: 'task-zero' }),
    updateTask: async () => {},
    saveTaskReferences: async () => {},
    saveTaskStrategy: async () => {},
    saveTaskOutputs: async () => {},
    understandTask: async () => createTaskUnderstanding(),
    retrieveTaskReferencesFromUnderstanding: async () => ({
      searchMode: 'lexical-only' as const,
      searchModeReason: 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。',
      referenceMode: 'zero-shot' as const,
      similarSamples: [],
      taskUnderstanding: createTaskUnderstanding(),
      taskEmbedding: [],
    }),
    startStrategyStream: async () => ({
      partialObjectStream: createAsyncIterable([createStrategyResult()]),
      object: Promise.resolve(createStrategyResult()),
    }),
    startGenerationStream: async () => ({
      textStream: createAsyncIterable([createGenerationTemplate()]),
    }),
  });

  const response = await POST(new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'zero-shot 任务' }),
  }));

  const events = await readSseEvents(response);
  const referencesEvent = events.find((event) => event.event === 'references');

  assert.deepEqual(referencesEvent?.data, {
    search_mode: 'lexical-only',
    search_mode_reason: 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。',
    reference_mode: 'zero-shot',
    candidate_count: 0,
    selected_references: [],
  });
});

test('POST /api/generate marks task as failed when strategizing throws', async () => {
  const statusUpdates: Array<{ status: string }> = [];

  const POST = createGeneratePostHandler({
    createTask: async () => ({ id: 'task-fail-strategy' }),
    updateTask: async (_taskId, patch) => {
      statusUpdates.push({ status: patch.status });
    },
    saveTaskReferences: async () => {},
    saveTaskStrategy: async () => {},
    saveTaskOutputs: async () => {},
    understandTask: async () => createTaskUnderstanding(),
    retrieveTaskReferencesFromUnderstanding: async () => ({
      referenceMode: 'referenced' as const,
      similarSamples: [],
      taskUnderstanding: createTaskUnderstanding(),
      taskEmbedding: [0.2],
    }),
    startStrategyStream: async () => {
      throw new Error('strategy failed');
    },
    startGenerationStream: async () => ({
      textStream: createAsyncIterable([createGenerationTemplate()]),
    }),
  });

  const response = await POST(new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '策略失败任务' }),
  }));

  const events = await readSseEvents(response);
  assert.equal(events.at(-1)?.event, 'error');
  assert.deepEqual(events.at(-1)?.data, {
    message: 'strategy failed',
    step: 'strategizing',
  });
  assert.equal(statusUpdates.at(-1)?.status, 'failed');
});

test('POST /api/generate marks task as failed when generation throws', async () => {
  const statusUpdates: Array<{ status: string }> = [];
  const strategy = createStrategyResult();

  const POST = createGeneratePostHandler({
    createTask: async () => ({ id: 'task-fail-generation' }),
    updateTask: async (_taskId, patch) => {
      statusUpdates.push({ status: patch.status });
    },
    saveTaskReferences: async () => {},
    saveTaskStrategy: async () => {},
    saveTaskOutputs: async () => {},
    understandTask: async () => createTaskUnderstanding(),
    retrieveTaskReferencesFromUnderstanding: async () => ({
      referenceMode: 'referenced' as const,
      similarSamples: [],
      taskUnderstanding: createTaskUnderstanding(),
      taskEmbedding: [0.2],
    }),
    startStrategyStream: async () => ({
      partialObjectStream: createAsyncIterable([strategy]),
      object: Promise.resolve(strategy),
    }),
    startGenerationStream: async () => ({
      textStream: {
        async *[Symbol.asyncIterator]() {
          yield '## 标题候选\n1. 标题一\n';
          throw new Error('generation failed');
        },
      },
    }),
  });

  const response = await POST(new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '生成失败任务' }),
  }));

  const events = await readSseEvents(response);
  assert.equal(events.at(-1)?.event, 'error');
  assert.deepEqual(events.at(-1)?.data, {
    message: 'generation failed',
    step: 'generating',
  });
  assert.equal(statusUpdates.at(-1)?.status, 'failed');
});
