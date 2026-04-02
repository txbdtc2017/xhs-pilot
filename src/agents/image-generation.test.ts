import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectGoogleImageStreamResult,
  generatePlannedImages,
} from './image-generation';

test('generatePlannedImages loops Google Banana single-image generation until candidate_count is satisfied', async () => {
  const calls: Array<{ prompt: string; modelName: string }> = [];

  const result = await generatePlannedImages(
    {
      provider: 'google_vertex',
      promptText: 'banana prompt',
      candidateCount: 3,
      modelName: 'gemini-3-pro-image-preview',
    },
    {
      generateOpenAiBatch: async () => {
        throw new Error('should not run');
      },
      generateGoogleSingle: async ({ prompt, modelName }) => {
        calls.push({ prompt, modelName });
        const index = calls.length;
        return {
          data: Buffer.from(`banana-${index}`),
          mimeType: 'image/png',
          width: 1024,
          height: 1536,
        };
      },
    },
  );

  assert.equal(result.length, 3);
  assert.deepEqual(calls, [
    { prompt: 'banana prompt', modelName: 'gemini-3-pro-image-preview' },
    { prompt: 'banana prompt', modelName: 'gemini-3-pro-image-preview' },
    { prompt: 'banana prompt', modelName: 'gemini-3-pro-image-preview' },
  ]);
});

test('collectGoogleImageStreamResult extracts image bytes and text from Gemini stream chunks', async () => {
  const stream = {
    async *[Symbol.asyncIterator]() {
      yield {
        candidates: [
          {
            content: {
              parts: [
                { text: 'banana ' },
                {
                  inlineData: {
                    data: Buffer.from('png-bytes').toString('base64'),
                  },
                },
              ],
            },
          },
        ],
      };

      yield {
        candidates: [
          {
            content: {
              parts: [{ text: 'done' }],
            },
          },
        ],
      };
    },
  };

  const result = await collectGoogleImageStreamResult(stream);

  assert.equal(result.text, 'banana done');
  assert.deepEqual(result.imageBytes, Buffer.from('png-bytes'));
});
