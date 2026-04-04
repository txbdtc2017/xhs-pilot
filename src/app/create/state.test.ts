import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStreamEvent,
  createInitialCreateState,
  createPageReducer,
} from './state';

function createGenerationComplete() {
  return {
    id: 'output-1',
    task_id: 'task-1',
    version: 1,
    model_name: 'gpt-4o',
    created_at: '2026-03-31T00:00:00.000Z',
    titles: ['标题一'],
    openings: ['开头一'],
    body_versions: ['正文一'],
    cta_versions: ['CTA 一'],
    cover_copies: [{ main: '封面主一', sub: '封面副一' }],
    hashtags: ['#标签一'],
    first_comment: '首评一',
    image_suggestions: '配图建议',
  };
}

function createHistoryDetail() {
  return {
    task: {
      id: 'task-1',
      topic: '历史任务一',
      status: 'completed',
      reference_mode: 'referenced',
    },
    strategy: {
      strategy_summary: '策略摘要',
      title_strategy: '结果先行',
    },
    references: [
      {
        sample_id: 'sample-1',
        title: '参考样本',
        reference_type: 'title',
        reason: '标题节奏',
      },
    ],
    output_versions: [
      {
        id: 'output-1',
        version: 1,
        model_name: 'gpt-4o',
        created_at: '2026-03-31T00:00:00.000Z',
      },
      {
        id: 'output-2',
        version: 2,
        model_name: 'gpt-4.1',
        created_at: '2026-03-31T01:00:00.000Z',
      },
    ],
    selected_output_id: 'output-2',
    outputs: {
      ...createGenerationComplete(),
      id: 'output-2',
      version: 2,
      model_name: 'gpt-4.1',
    },
    latest_image_plan: {
      plan: {
        id: 'plan-1',
        output_id: 'output-2',
        status: 'ready',
        provider: 'google_vertex',
        provider_model: 'gemini-3-pro-image-preview',
      },
      pages: [
        {
          id: 'page-1',
          plan_id: 'plan-1',
          sort_order: 0,
          page_role: 'cover',
          is_enabled: true,
          content_purpose: '封面结论页',
          source_excerpt: '封面主标题',
          visual_type: 'info-card',
          style_reason: '高对比大字',
          prompt_summary: '高对比',
          prompt_text: 'prompt',
          candidate_count: 2,
        },
      ],
      assets: [
        {
          id: 'asset-1',
          plan_page_id: 'page-1',
          image_url: '/uploads/asset-1.png',
          candidate_index: 0,
          is_selected: true,
        },
        {
          id: 'asset-2',
          plan_page_id: 'page-1',
          image_url: '/uploads/asset-2.png',
          candidate_index: 1,
          is_selected: false,
        },
      ],
      selected_assets: [
        {
          id: 'asset-1',
          plan_page_id: 'page-1',
          image_url: '/uploads/asset-1.png',
          candidate_index: 0,
          is_selected: true,
        },
      ],
    },
    active_image_job: null,
    reference_mode: 'referenced',
    feedback: null,
  };
}

test('applyStreamEvent updates task understanding, references, strategy, and generation text in order', () => {
  let state = createInitialCreateState();
  state = createPageReducer(state, { type: 'submit_started' });

  state = applyStreamEvent(state, {
    event: 'task_understanding',
    data: {
      task_type: '干货',
      suitable_structure: '三段式',
      reference_focus: ['标题', '结构'],
      notes: '避免空泛表达',
      search_filters: { track: '职场' },
      rewritten_query: '职场 收藏',
      goal: '收藏',
    },
  });
  state = applyStreamEvent(state, {
    event: 'references',
    data: {
      search_mode: 'hybrid',
      search_mode_reason: null,
      reference_mode: 'referenced',
      candidate_count: 3,
      selected_references: [
        {
          sample_id: 'sample-1',
          title: '样本一',
          similarity: 0.9,
          reference_type: 'title',
          reason: '标题节奏好',
        },
      ],
    },
  });
  state = applyStreamEvent(state, {
    event: 'strategy_snapshot',
    data: {
      content_direction: '干货',
      title_strategy: '标题策略',
      cta_strategy: '引导收藏',
    },
  });
  state = applyStreamEvent(state, {
    event: 'generation_delta',
    data: { text: '第一段' },
  });
  state = applyStreamEvent(state, {
    event: 'generation_delta',
    data: { text: '第二段' },
  });

  assert.equal(state.isSubmitting, true);
  assert.equal(state.taskUnderstanding?.task_type, '干货');
  assert.equal(state.references?.reference_mode, 'referenced');
  assert.equal(state.strategySnapshot?.cta_strategy, '引导收藏');
  assert.equal(state.generationText, '第一段第二段');
  assert.equal(state.step, 'generating');
});

test('applyStreamEvent finalizes outputs and stores task id on done', () => {
  let state = createPageReducer(createInitialCreateState(), { type: 'submit_started' });
  state = applyStreamEvent(state, {
    event: 'generation_complete',
    data: createGenerationComplete(),
  });
  state = applyStreamEvent(state, {
    event: 'done',
    data: { task_id: 'task-1' },
  });

  assert.equal(state.isSubmitting, false);
  assert.equal(state.step, 'completed');
  assert.equal(state.taskId, 'task-1');
  assert.equal(state.outputs?.titles[0], '标题一');
});

test('applyStreamEvent records errors and leaves the latest content visible', () => {
  let state = createPageReducer(createInitialCreateState(), { type: 'submit_started' });
  state = applyStreamEvent(state, {
    event: 'generation_delta',
    data: { text: '已经生成的内容' },
  });
  state = applyStreamEvent(state, {
    event: 'error',
    data: { message: 'generation failed', step: 'generating' },
  });

  assert.equal(state.isSubmitting, false);
  assert.equal(state.step, 'failed');
  assert.equal(state.error, 'generation failed');
  assert.equal(state.generationText, '已经生成的内容');
});

test('applyStreamEvent appends readable runtime logs and avoids one row per generation chunk', () => {
  let state = createPageReducer(createInitialCreateState(), {
    type: 'submit_started',
    now: '2026-04-04T10:00:00.000Z',
  });

  state = applyStreamEvent(state, {
    event: 'status',
    data: {
      step: 'understanding',
      message: '开始任务理解',
    },
  }, '2026-04-04T10:00:01.000Z');
  state = applyStreamEvent(state, {
    event: 'task_understanding',
    data: {
      task_type: '干货',
      suitable_structure: '三段式',
      reference_focus: ['标题', '结构'],
      notes: '避免空泛表达',
      search_filters: { track: '职场' },
      rewritten_query: '职场 收藏',
      goal: '收藏',
    },
  }, '2026-04-04T10:00:02.000Z');
  state = applyStreamEvent(state, {
    event: 'strategy_snapshot',
    data: {
      content_direction: '干货',
    },
  }, '2026-04-04T10:00:03.000Z');
  state = applyStreamEvent(state, {
    event: 'generation_delta',
    data: { text: '第一段' },
  }, '2026-04-04T10:00:04.000Z');
  state = applyStreamEvent(state, {
    event: 'generation_delta',
    data: { text: '第二段' },
  }, '2026-04-04T10:00:05.000Z');

  assert.equal(state.lastServerEventAt, '2026-04-04T10:00:05.000Z');
  assert.equal(state.currentStepStartedAt, '2026-04-04T10:00:04.000Z');
  assert.deepEqual(
    state.generationLogs.map((entry) => entry.message),
    ['开始任务理解', '任务理解完成', '收到首个策略快照', '正文流已开始'],
  );
});

test('createPageReducer records unexpected stream closure and keeps the log panel open', () => {
  let state = createPageReducer(createInitialCreateState(), {
    type: 'submit_started',
    now: '2026-04-04T10:00:00.000Z',
  });

  state = createPageReducer(state, {
    type: 'stream_closed',
    now: '2026-04-04T10:00:12.000Z',
    expectedTerminal: false,
  });

  assert.equal(state.streamClosedUnexpectedly, true);
  assert.equal(state.isLogPanelExpanded, true);
  assert.equal(state.generationLogs.at(-1)?.source, 'system');
  assert.match(state.generationLogs.at(-1)?.message ?? '', /未收到 done 或 error/);
});

test('idle_warning_triggered appends only one quiet-period warning per active step', () => {
  let state = createPageReducer(createInitialCreateState(), {
    type: 'submit_started',
    now: '2026-04-04T10:00:00.000Z',
  });

  state = createPageReducer(state, {
    type: 'idle_warning_triggered',
    now: '2026-04-04T10:00:10.000Z',
  });
  state = createPageReducer(state, {
    type: 'idle_warning_triggered',
    now: '2026-04-04T10:00:15.000Z',
  });

  assert.equal(
    state.generationLogs.filter((entry) => entry.event === 'idle_warning').length,
    1,
  );
});

test('createPageReducer stores history list and selected task detail without clearing live form state', () => {
  let state = createInitialCreateState();
  state = createPageReducer(state, {
    type: 'form_changed',
    field: 'topic',
    value: '保留当前主题',
  });
  state = createPageReducer(state, { type: 'history_list_requested' });
  state = createPageReducer(state, {
    type: 'history_list_loaded',
    tasks: [
      {
        id: 'task-1',
        topic: '历史任务一',
        status: 'completed',
        reference_mode: 'referenced',
        created_at: '2026-03-22T10:00:00.000Z',
      },
    ],
  });
  state = createPageReducer(state, { type: 'history_detail_requested', taskId: 'task-1' });
  state = createPageReducer(state, {
    type: 'history_detail_loaded',
    taskId: 'task-1',
    detail: createHistoryDetail(),
  });

  assert.equal(state.form.topic, '保留当前主题');
  assert.equal(state.isHistoryLoading, false);
  assert.equal(state.historyTasks.length, 1);
  assert.equal(state.selectedHistoryTaskId, 'task-1');
  assert.equal(state.selectedHistoryDetail?.task.topic, '历史任务一');
  assert.equal(state.selectedHistoryDetail?.references[0]?.title, '参考样本');
});

test('submit_started preserves loaded history data while resetting the live generation pane', () => {
  let state = createPageReducer(createInitialCreateState(), {
    type: 'history_list_loaded',
    tasks: [
      {
        id: 'task-1',
        topic: '历史任务一',
        status: 'completed',
        reference_mode: 'referenced',
        created_at: '2026-03-22T10:00:00.000Z',
      },
    ],
  });
  state = createPageReducer(state, {
    type: 'history_detail_loaded',
    taskId: 'task-1',
    detail: createHistoryDetail(),
  });
  state = createPageReducer(state, { type: 'submit_started' });

  assert.equal(state.isSubmitting, true);
  assert.equal(state.generationText, '');
  assert.equal(state.outputs, null);
  assert.equal(state.historyTasks.length, 1);
  assert.equal(state.selectedHistoryTaskId, 'task-1');
  assert.equal(state.selectedHistoryDetail?.task.topic, '历史任务一');
});

test('history_detail_loaded tracks the currently selected output version for history switching', () => {
  const state = createPageReducer(createInitialCreateState(), {
    type: 'history_detail_loaded',
    taskId: 'task-1',
    outputId: 'output-2',
    detail: createHistoryDetail(),
  });

  assert.equal(state.selectedHistoryTaskId, 'task-1');
  assert.equal(state.selectedHistoryOutputId, 'output-2');
  assert.equal(state.selectedHistoryDetail?.selected_output_id, 'output-2');
});

test('image_job_snapshot_loaded refreshes active job progress and merges plan assets', () => {
  let state = createPageReducer(createInitialCreateState(), {
    type: 'history_detail_loaded',
    taskId: 'task-1',
    detail: createHistoryDetail(),
  });

  state = createPageReducer(state, {
    type: 'image_job_snapshot_loaded',
    taskId: 'task-1',
    snapshot: {
      job: {
        id: 'job-1',
        plan_id: 'plan-1',
        scope: 'full',
        plan_page_id: null,
        provider: 'google_vertex',
        status: 'running',
        total_units: 3,
        completed_units: 2,
        error_message: null,
        model_name: 'gpt-image-1',
        created_at: '2026-03-31T00:00:00.000Z',
        started_at: '2026-03-31T00:00:01.000Z',
        finished_at: null,
      },
      plan: {
        id: 'plan-1',
        output_id: 'output-2',
        status: 'ready',
        provider: 'google_vertex',
        provider_model: 'gemini-3-pro-image-preview',
      },
      pages: [
        {
          id: 'page-1',
          sort_order: 0,
          page_role: 'cover',
          is_enabled: true,
          candidate_count: 2,
        },
      ],
      assets: [
        {
          id: 'asset-1',
          plan_page_id: 'page-1',
          image_url: '/uploads/asset-1.png',
          candidate_index: 0,
          is_selected: false,
        },
        {
          id: 'asset-2',
          plan_page_id: 'page-1',
          image_url: '/uploads/asset-2.png',
          candidate_index: 1,
          is_selected: true,
        },
      ],
      selected_assets: [
        {
          id: 'asset-2',
          plan_page_id: 'page-1',
          image_url: '/uploads/asset-2.png',
          candidate_index: 1,
          is_selected: true,
        },
      ],
    },
  });

  assert.equal(state.selectedHistoryDetail?.active_image_job?.completed_units, 2);
  assert.equal(state.selectedHistoryDetail?.latest_image_plan?.selected_assets[0]?.id, 'asset-2');
});

test('image_asset_selected flips the selected flag within the current plan assets', () => {
  let state = createPageReducer(createInitialCreateState(), {
    type: 'history_detail_loaded',
    taskId: 'task-1',
    detail: createHistoryDetail(),
  });

  state = createPageReducer(state, {
    type: 'image_asset_selected',
    taskId: 'task-1',
    asset: {
      id: 'asset-2',
      plan_page_id: 'page-1',
      image_url: '/uploads/asset-2.png',
      candidate_index: 1,
      is_selected: true,
    },
  });

  assert.equal(state.selectedHistoryDetail?.latest_image_plan?.selected_assets[0]?.id, 'asset-2');
  assert.equal(
    state.selectedHistoryDetail?.latest_image_plan?.assets.find((asset) => asset.id === 'asset-1')?.is_selected,
    false,
  );
});
