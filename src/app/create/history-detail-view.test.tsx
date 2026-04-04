import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HistoryDetailView } from './history-detail-view';
import type { HistoryTaskDetail } from './models';

const testClasses = {
  list: 'list',
  kvList: 'kvList',
  kvItem: 'kvItem',
  kvLabel: 'kvLabel',
  kvValue: 'kvValue',
  panelHint: 'panelHint',
  resultCard: 'resultCard',
  referenceMeta: 'referenceMeta',
  versionTabs: 'versionTabs',
  versionButton: 'versionButton',
  versionButtonActive: 'versionButtonActive',
  emptyState: 'emptyState',
};

const detail: HistoryTaskDetail = {
  task: {
    id: 'task-1',
    topic: '宁波天童寺周末攻略',
    status: 'completed',
    target_audience: '周末带娃家庭',
    goal: '收藏',
  },
  runtime: {
    lifecycle_state: 'completed',
    current_step: 'generating',
    started_at: '2026-04-04T08:00:00.000Z',
    last_progress_at: '2026-04-04T08:01:00.000Z',
    last_heartbeat_at: '2026-04-04T08:01:00.000Z',
    stalled_at: null,
    failed_at: null,
    stalled_reason: null,
    failure_reason: null,
  },
  strategy: {
    strategy_summary: '主打寺院古建、停车和亲子友好路线。',
    title_strategy: '突出近郊周末、清净感和实用路线。',
    structure_strategy: '交通-路线-注意事项。',
    cta_strategy: '收藏备用。',
  },
  references: [
    {
      sample_id: 'sample-1',
      title: '寺院游览模板',
      reference_type: 'structure',
      reason: '适合路线型内容',
    },
  ],
  output_versions: [
    {
      id: 'output-1',
      version: 1,
      model_name: 'kimi-for-coding',
      created_at: '2026-04-04T08:01:00.000Z',
    },
  ],
  selected_output_id: 'output-1',
  outputs: {
    id: 'output-1',
    version: 1,
    model_name: 'kimi-for-coding',
    titles: ['宁波天童寺一日游，带娃也不累'],
    openings: ['如果你想找一个安静但不无聊的周末去处，天童寺很合适。'],
    body_versions: ['路线、停车、斋饭和拍照点都整理好了。'],
    cta_versions: ['先收藏，周末直接照着走。'],
    cover_copies: [{ main: '宁波天童寺', sub: '周末一日游攻略' }],
    hashtags: ['#宁波周末', '#天童寺'],
    first_comment: '停车和步行路线放评论区补充。',
    image_suggestions: '寺院门头、古树步道、香火氛围。',
  },
  latest_image_plan: {
    plan: {
      id: 'plan-1',
      output_id: 'output-1',
      status: 'completed',
      provider: 'google_vertex',
      provider_model: 'gemini-3-pro-image-preview',
      system_decision_summary: '封面强调寺院古建和松弛感。',
    },
    pages: [],
    assets: [
      {
        id: 'asset-1',
        plan_page_id: 'page-1',
        image_url: 'https://example.com/cover.png',
        candidate_index: 0,
        is_selected: true,
      },
    ],
    selected_assets: [
      {
        id: 'asset-1',
        plan_page_id: 'page-1',
        image_url: 'https://example.com/cover.png',
        candidate_index: 0,
        is_selected: true,
      },
    ],
  },
  active_image_job: null,
  reference_mode: 'referenced',
  feedback: {
    used_in_publish: false,
    manual_feedback: '结构顺。',
  },
};

test('history detail view stays read-only while still exposing output versions and image summary', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryDetailView, {
      classes: testClasses,
      detail,
      selectedOutputId: 'output-1',
      onSelectOutputVersion: () => undefined,
    }),
  );

  assert.match(html, /宁波天童寺周末攻略/);
  assert.match(html, /v1/);
  assert.match(html, /策略摘要/);
  assert.match(html, /图片结果摘要/);
  assert.match(html, /Google Banana/);
  assert.match(html, /已选 1 张/);
  assert.doesNotMatch(html, /生成整套图片|单页重生|生成图片计划/);
});
