import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { StudioTabs } from './studio-tabs';

const classes = {
  studioTabs: 'studioTabs',
  studioTab: 'studioTab',
  studioTabActive: 'studioTabActive',
};

test('studio tabs render all workflow tabs and preserve task context in links', () => {
  const html = renderToStaticMarkup(createElement(StudioTabs, {
    classes,
    activeTab: 'images',
    taskId: 'task-1',
    outputId: 'output-2',
  }));

  assert.match(html, /文案创作/);
  assert.match(html, /图片创作/);
  assert.match(html, /发布/);
  assert.match(html, /href="\/create\?taskId=task-1&amp;outputId=output-2"/);
  assert.match(html, /href="\/create\/images\?taskId=task-1&amp;outputId=output-2"/);
  assert.match(html, /href="\/create\/publish\?taskId=task-1&amp;outputId=output-2"/);
  assert.match(html, /studioTabActive/);
});
