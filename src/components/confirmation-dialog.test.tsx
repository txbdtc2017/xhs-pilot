import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ConfirmationDialog } from './confirmation-dialog';

test('confirmation dialog renders an accessible destructive modal shell', () => {
  const html = renderToStaticMarkup(
    createElement(ConfirmationDialog, {
      open: true,
      title: '永久删除任务',
      description: '该任务及其所有生成版本和图片记录都会被彻底移除，且无法撤销。',
      confirmLabel: '确认永久删除',
      cancelLabel: '取消',
      onCancel: () => undefined,
      onConfirm: () => undefined,
    }),
  );

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /永久删除任务/);
  assert.match(html, /确认永久删除/);
  assert.match(html, /取消/);
});
