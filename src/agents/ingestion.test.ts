import assert from 'node:assert/strict';
import test from 'node:test';

import { processIngestionText } from './ingestion';

test('processIngestionText normalizes whitespace and removes invisible control characters', () => {
  const input = '\u200b  标题\t  第一段\u0007\r\n\r\n\r\n第二段  \u200d\r\n\r\n\r\n\r\n第三段  ';

  const output = processIngestionText(input);

  assert.equal(output, '标题 第一段\n\n第二段\n\n第三段');
});

