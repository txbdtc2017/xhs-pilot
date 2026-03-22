import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import OfflinePage from './page';

test('offline page explains the limited offline experience', () => {
  const html = renderToStaticMarkup(createElement(OfflinePage));

  assert.match(html, /你当前处于离线状态/);
  assert.match(html, /可安装、可缓存静态壳、离线时有友好提示/);
});
