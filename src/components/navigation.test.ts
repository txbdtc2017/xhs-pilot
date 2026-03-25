import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { APP_VERSION } from '../lib/app-version';
import { NavigationContent } from './navigation';

test('navigation renders the app version in the left-column footer area', () => {
  const html = renderToStaticMarkup(createElement(NavigationContent, {
    pathname: '/',
    isOpen: false,
  }));

  assert.match(html, new RegExp(`版本 v${APP_VERSION}`));
  assert.match(html, /app-navMeta/);
  assert.match(html, /录入样本/);
  assert.match(html, /开始创作/);
});
