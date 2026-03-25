import assert from 'node:assert/strict';
import test from 'node:test';

import { createPageCopy } from './copy';

test('create page copy frames the studio as a reference-driven creation workspace', () => {
  assert.equal(createPageCopy.heroEyebrow, 'Creation Workspace');
  assert.equal(createPageCopy.heroTitle, '让内容参考有据，让创作链路可见。');
  assert.match(createPageCopy.heroSubtitle, /检索样本/);
  assert.match(createPageCopy.fallbackSubtitle, /正在加载创作工作台/);
});
