import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { HistoryTaskDetail } from './models';
import { PublishWorkbench } from './publish-workbench';

const testClasses = {
  panel: 'panel',
  panelHeader: 'panelHeader',
  panelTitle: 'panelTitle',
  panelHint: 'panelHint',
  list: 'list',
  kvList: 'kvList',
  kvItem: 'kvItem',
  kvLabel: 'kvLabel',
  kvValue: 'kvValue',
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
  },
  runtime: {
    lifecycle_state: 'completed',
    current_step: 'completed',
    started_at: '2026-04-04T08:00:00.000Z',
    last_progress_at: '2026-04-04T08:01:00.000Z',
    last_heartbeat_at: '2026-04-04T08:01:00.000Z',
    stalled_at: null,
    failed_at: null,
    stalled_reason: null,
    failure_reason: null,
  },
  strategy: null,
  references: [],
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
    assets: [],
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
  feedback: null,
};

test('publish workbench renders a publish package preview and a placeholder publish status', () => {
  const html = renderToStaticMarkup(
    createElement(PublishWorkbench, {
      classes: testClasses,
      detail,
      selectedOutputId: 'output-1',
      onSelectOutputVersion: () => undefined,
    }),
  );

  assert.match(html, /发布准备台/);
  assert.match(html, /小红书发布能力待接入/);
  assert.match(html, /宁波天童寺一日游，带娃也不累/);
  assert.match(html, /停车和步行路线放评论区补充。/);
  assert.match(html, /已选图片 1 张/);
});
