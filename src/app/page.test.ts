import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HomePageContent } from './page';

test('home page content does not render the app version badge directly', () => {
  const html = renderToStaticMarkup(createElement(HomePageContent, {
    stats: {
      overview: {
        total_samples: 12,
        new_samples_this_week: 3,
        high_value_samples: 2,
        style_profiles: 1,
      },
      track_distribution: [],
      content_type_distribution: [],
      recent_samples: [],
      recent_tasks: [],
      top_references: [],
    },
  }));

  assert.doesNotMatch(html, /版本 v0\.2\.0/);
});
