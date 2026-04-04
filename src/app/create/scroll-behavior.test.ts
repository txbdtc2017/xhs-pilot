import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const studioTabsSource = readFileSync(
  path.join(process.cwd(), 'src/app/create/studio-tabs.tsx'),
  'utf8',
);
const taskContextPickerSource = readFileSync(
  path.join(process.cwd(), 'src/app/create/task-context-picker.tsx'),
  'utf8',
);
const imagesPageSource = readFileSync(
  path.join(process.cwd(), 'src/app/create/images/page.tsx'),
  'utf8',
);
const publishPageSource = readFileSync(
  path.join(process.cwd(), 'src/app/create/publish/page.tsx'),
  'utf8',
);
const historyPageSource = readFileSync(
  path.join(process.cwd(), 'src/app/history/page.tsx'),
  'utf8',
);

test('context links inside the studio opt out of Next.js automatic scroll resets', () => {
  assert.match(studioTabsSource, /scroll=\{false\}/);
  assert.match(taskContextPickerSource, /scroll=\{false\}/);
});

test('same-page task and output switching keeps scroll position when query params change', () => {
  assert.match(imagesPageSource, /router\.replace\(buildCreateImagesHref\(requestedTaskId, outputId\), \{ scroll: false \}\)/);
  assert.match(publishPageSource, /router\.replace\(buildCreatePublishHref\(requestedTaskId, outputId\), \{ scroll: false \}\)/);
  assert.match(historyPageSource, /router\.replace\(buildHistoryTaskHref\(taskId\), \{ scroll: false \}\)/);
  assert.match(historyPageSource, /router\.replace\(buildHistoryTaskHref\(preferredTaskId, outputId\), \{ scroll: false \}\)/);
});
