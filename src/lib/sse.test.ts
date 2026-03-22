import assert from 'node:assert/strict';
import test from 'node:test';

import { createSseParser, formatSseEvent } from './sse';

test('formatSseEvent encodes named SSE events with JSON payloads', () => {
  assert.equal(
    formatSseEvent('done', { task_id: 'task-1' }),
    'event: done\ndata: {"task_id":"task-1"}\n\n',
  );
});

test('createSseParser reconstructs named events across chunk boundaries', () => {
  const parsed: Array<{ event: string; data: unknown }> = [];
  const parser = createSseParser((event) => {
    parsed.push(event);
  });

  parser.push('event: task_under');
  parser.push('standing\ndata: {"task_type":"干货"}\n\n');
  parser.push('event: generation_delta\ndata: {"text":"第一段"}\n\n');
  parser.flush();

  assert.deepEqual(parsed, [
    {
      event: 'task_understanding',
      data: { task_type: '干货' },
    },
    {
      event: 'generation_delta',
      data: { text: '第一段' },
    },
  ]);
});
