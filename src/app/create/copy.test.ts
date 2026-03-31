import assert from 'node:assert/strict';
import test from 'node:test';

import { createPageCopy } from './copy';

test('create page copy stays neutral and avoids redesign concept wording', () => {
  assert.equal(createPageCopy.heroEyebrow, 'Create');
  assert.equal(createPageCopy.heroTitle, '创作工作台');
  assert.equal(createPageCopy.heroSubtitle, '输入主题、参考偏好和目标后开始生成。');
  assert.equal(createPageCopy.fallbackSubtitle, '正在加载创作工作台…');
});
