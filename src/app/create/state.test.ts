import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStreamEvent,
  createInitialCreateState,
  createPageReducer,
} from './state';

function createGenerationComplete() {
  return {
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
