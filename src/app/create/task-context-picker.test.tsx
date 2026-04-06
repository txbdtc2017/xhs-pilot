import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { HistoryTaskSummary } from './models';
import { TaskContextPicker } from './task-context-picker';

const testClasses = {
  panel: 'panel',
  panelHeader: 'panelHeader',
  panelTitle: 'panelTitle',
  panelHint: 'panelHint',
  emptyState: 'emptyState',
  list: 'list',
  historyTaskButton: 'historyTaskButton',
  historyTaskButtonActive: 'historyTaskButtonActive',
  historyTaskHeader: 'historyTaskHeader',
  historyTaskStatus: 'historyTaskStatus',
  historyTaskMeta: 'historyTaskMeta',
};

const tasks: HistoryTaskSummary[] = [
  {
    id: 'task-1',
    topic: '宁波天童寺周末攻略',
    status: 'completed',
    reference_mode: 'referenced',
    created_at: '2026-04-04T08:00:00.000Z',
  },
];

const createPageStylesSource = readFileSync(
  path.join(process.cwd(), 'src/app/create/page.module.css'),
  'utf8',
);

test('task context picker renders a compact recent-task selector when no workflow context is active', () => {
  const html = renderToStaticMarkup(
    createElement(TaskContextPicker, {
      classes: testClasses,
      title: '选择任务',
      hint: '先选一条文案任务再继续。',
      emptyMessage: '先从文案创作生成一条结果，或手动选择已有任务。',
      tasks,
      selectedTaskId: null,
      buildHref: (taskId: string) => `/create/images?taskId=${taskId}`,
    }),
  );

  assert.match(html, /选择任务/);
  assert.match(html, /先从文案创作生成一条结果，或手动选择已有任务。/);
  assert.match(html, /宁波天童寺周末攻略/);
  assert.match(html, /href="\/create\/images\?taskId=task-1"/);
});

test('task context picker keeps the shared history task link styles card-like for create flows', () => {
  assert.match(createPageStylesSource, /\.historyTaskButton\s*\{[\s\S]*padding:\s*14px;[\s\S]*border-radius:\s*14px;[\s\S]*border:\s*1px solid var\(--color-border\);[\s\S]*background:\s*rgba\(255,\s*252,\s*247,\s*0\.96\);/);
  assert.match(createPageStylesSource, /\.historyTaskButtonActive\s*\{/);
});
