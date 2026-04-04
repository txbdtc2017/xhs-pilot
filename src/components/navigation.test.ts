import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { APP_VERSION } from '../lib/app-version';
import { NavigationContent } from './navigation';

test('navigation renders the compact workbench bar with persistent primary actions', () => {
  const html = renderToStaticMarkup(createElement(NavigationContent, {
    pathname: '/',
    isOpen: false,
  }));

  assert.match(html, new RegExp(`版本 v${APP_VERSION}`));
  assert.match(html, /workbenchBar/);
  assert.match(html, /录入样本/);
  assert.match(html, /开始创作/);
  assert.match(html, /历史任务/);
  assert.doesNotMatch(html, /研究工作台|导航与动作/);
  assert.match(html, /XHS Pilot/);
});
