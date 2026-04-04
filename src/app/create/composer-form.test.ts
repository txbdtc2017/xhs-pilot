import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CreateComposerForm } from './composer-form';

const testClasses = {
  panel: 'panel',
  composerPanel: 'composerPanel',
  panelHeader: 'panelHeader',
  panelTitle: 'panelTitle',
  panelHint: 'panelHint',
  composerLayout: 'composerLayout',
  composerPrimary: 'composerPrimary',
  composerSecondary: 'composerSecondary',
  field: 'field',
  topicField: 'topicField',
  fieldLabel: 'fieldLabel',
  textarea: 'textarea',
  topicTextarea: 'topicTextarea',
  controlGrid: 'controlGrid',
  input: 'input',
  select: 'select',
  composerActions: 'composerActions',
  checkboxCard: 'checkboxCard',
  checkboxControl: 'checkboxControl',
  checkboxInput: 'checkboxInput',
  checkboxText: 'checkboxText',
  checkboxHint: 'checkboxHint',
  submitButton: 'submitButton',
  errorBox: 'errorBox',
};

test('composer form groups the primary input, task settings, and submit actions into separate regions', () => {
  const html = renderToStaticMarkup(
    createElement(CreateComposerForm, {
      classes: testClasses,
      form: {
        topic: '写一篇让人想收藏的职场复盘笔记',
        targetAudience: '3-5 年经验职场人',
        goal: '收藏 / 评论 / 转化',
        stylePreference: '专业直接、克制、有结论',
        personaMode: 'balanced',
        needCoverSuggestion: true,
      },
      isSubmitting: false,
      error: null,
      onSubmit: () => undefined,
      onFieldChange: () => undefined,
    }),
  );

  assert.match(html, /aria-label="主题输入区"/);
  assert.match(html, /aria-label="任务参数区"/);
  assert.match(html, /aria-label="提交操作区"/);
  assert.match(html, /需要封面建议/);
  assert.doesNotMatch(html, /图片提供方|Google Banana|图片视觉方向|正文页上限/);
  assert.match(html, /生成/);
});
