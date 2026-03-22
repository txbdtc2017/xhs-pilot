import assert from 'node:assert/strict';
import test from 'node:test';

import { createDashboardStatsGetHandler } from './route';

test('GET /api/dashboard/stats returns aggregated dashboard data', async () => {
  const GET = createDashboardStatsGetHandler({
    getDashboardStats: async () => ({
      overview: {
        total_samples: 42,
        new_samples_this_week: 6,
        high_value_samples: 8,
        style_profiles: 3,
      },
      track_distribution: [{ label: '职场', count: 12 }],
      content_type_distribution: [{ label: '清单', count: 10 }],
      recent_samples: [{ id: 'sample-1', title: '最近样本' }],
      recent_tasks: [{ id: 'task-1', topic: '最近任务' }],
      top_references: [{ id: 'sample-2', title: '热门参考', reference_count: 5 }],
    }),
  });

  const response = await GET(new Request('http://localhost/api/dashboard/stats'));
  const payload = await response.json();

  assert.deepEqual(payload, {
    overview: {
      total_samples: 42,
      new_samples_this_week: 6,
      high_value_samples: 8,
      style_profiles: 3,
    },
    track_distribution: [{ label: '职场', count: 12 }],
    content_type_distribution: [{ label: '清单', count: 10 }],
    recent_samples: [{ id: 'sample-1', title: '最近样本' }],
    recent_tasks: [{ id: 'task-1', topic: '最近任务' }],
    top_references: [{ id: 'sample-2', title: '热门参考', reference_count: 5 }],
  });
});
