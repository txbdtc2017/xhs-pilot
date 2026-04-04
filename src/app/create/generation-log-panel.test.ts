import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GenerationLogPanel } from './generation-log-panel';

const testClasses = {
  panel: 'panel',
  panelHeader: 'panelHeader',
  panelTitle: 'panelTitle',
  panelHint: 'panelHint',
  logPanel: 'logPanel',
  logSummary: 'logSummary',
  logSummaryMeta: 'logSummaryMeta',
  logToggle: 'logToggle',
  logMetaGrid: 'logMetaGrid',
  logMetaCard: 'logMetaCard',
  logMetaLabel: 'logMetaLabel',
  logMetaValue: 'logMetaValue',
  logTimeline: 'logTimeline',
  logRow: 'logRow',
  logRowServer: 'logRowServer',
  logRowClient: 'logRowClient',
  logRowSystem: 'logRowSystem',
  logRowHeader: 'logRowHeader',
  logSource: 'logSource',
  logEvent: 'logEvent',
  logTimestamp: 'logTimestamp',
  logMessage: 'logMessage',
  emptyState: 'emptyState',
};

test('generation log panel renders runtime metadata and ordered log rows', () => {
  const html = renderToStaticMarkup(
    createElement(GenerationLogPanel, {
      classes: testClasses,
      isExpanded: true,
      taskId: 'task-1',
      currentStep: 'strategizing',
      isSubmitting: true,
      submitStartedAt: '2026-04-04T10:00:00.000Z',
      currentStepStartedAt: '2026-04-04T10:00:05.000Z',
      lastServerEventAt: '2026-04-04T10:00:08.000Z',
      clockNow: '2026-04-04T10:00:12.000Z',
      streamClosedUnexpectedly: false,
      logs: [
        {
          id: 'log-1',
          at: '2026-04-04T10:00:01.000Z',
          source: 'client',
          event: 'request_sent',
          message: '已发送生成请求',
        },
        {
          id: 'log-2',
          at: '2026-04-04T10:00:08.000Z',
          source: 'server',
          event: 'status',
          message: '等待最终策略定稿',
        },
      ],
      onToggle: () => undefined,
    }),
  );

  assert.match(html, /运行日志/);
  assert.match(html, /task-1/);
  assert.match(html, /strategizing/);
  assert.match(html, /7s/);
  assert.match(html, /4s/);
  assert.match(html, /已发送生成请求/);
  assert.match(html, /等待最终策略定稿/);
});
