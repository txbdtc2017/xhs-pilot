import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import OfflinePage from './page';

test('offline page explains the limited offline experience', () => {
  const html = renderToStaticMarkup(createElement(OfflinePage));

  assert.match(html, /离线/);
  assert.match(html, /当前设备离线/);
  assert.match(html, /返回首页/);
  assert.doesNotMatch(html, /离线工作台外壳|创作轨道|资产指挥台/);
});
