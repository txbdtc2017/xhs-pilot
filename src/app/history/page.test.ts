import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const historyPageSource = readFileSync(
  path.join(process.cwd(), 'src/app/history/page.tsx'),
  'utf8',
);

test('history page keeps delete controls inside each task card header and opens a standalone modal directly', () => {
  assert.match(historyPageSource, /historyTaskHeaderActions/);
  assert.match(
    historyPageSource,
    /className=\{styles\.historyTaskHeaderActions\}[\s\S]*删除任务/,
  );
  assert.match(
    historyPageSource,
    /onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*handleDeleteModalOpen\(task\.id\);\s*\}\}/,
  );
  assert.doesNotMatch(historyPageSource, /deleteInlineWarning/);
});

test('history page keeps the full task card clickable while delete buttons stay isolated', () => {
  assert.match(
    historyPageSource,
    /<article[\s\S]*className=\{`\$\{styles\.historyTaskCard\} \$\{isActive \? styles\.historyTaskCardActive : ''\}`\}[\s\S]*onClick=\{\(\) => handleTaskSelect\(task\.id\)\}/,
  );
  assert.match(
    historyPageSource,
    /onCancel=\{handleDeleteCancel\}/,
  );
  assert.match(
    historyPageSource,
    /onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*handleDeleteModalOpen\(task\.id\);\s*\}\}/,
  );
});
