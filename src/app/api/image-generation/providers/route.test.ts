import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageGenerationProvidersGetHandler } from './route';

test('GET /api/image-generation/providers returns the provider list and current default provider', async () => {
  const GET = createImageGenerationProvidersGetHandler({
    listProviders: () => ({
      providers: [
        {
          provider: 'openai',
          label: 'OpenAI-Compatible',
          available: true,
          model: 'gpt-image-1',
        },
        {
          provider: 'google_vertex',
          label: 'Google Banana',
          available: true,
          model: 'gemini-3-pro-image-preview',
        },
      ],
      defaultProvider: 'openai',
    }),
  });

  const response = await GET(new Request('http://localhost/api/image-generation/providers'));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    providers: [
      {
        provider: 'openai',
        label: 'OpenAI-Compatible',
        available: true,
        model: 'gpt-image-1',
      },
      {
        provider: 'google_vertex',
        label: 'Google Banana',
        available: true,
        model: 'gemini-3-pro-image-preview',
      },
    ],
    default_provider: 'openai',
  });
});
