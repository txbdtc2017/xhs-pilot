import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import OfflinePage from './page';

test('offline page explains the limited offline experience', () => {
  const html = renderToStaticMarkup(createElement(OfflinePage));

  assert.match(html, /你当前处于离线状态/);
  assert.match(html, /离线时仍可查看已缓存的工作台外壳/);
  assert.match(html, /返回资产总览/);
});
