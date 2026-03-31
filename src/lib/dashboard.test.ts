import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDashboardContentTypeDistributionQuery,
  buildDashboardHighValueSamplesQuery,
  buildDashboardRecentSamplesQuery,
  buildDashboardTopReferencesQuery,
  buildDashboardTotalSamplesQuery,
  buildDashboardTrackDistributionQuery,
} from './dashboard';

test('dashboard sample-backed queries exclude deleted samples', () => {
  assert.match(buildDashboardTotalSamplesQuery(), /FROM samples s\s+WHERE s\.deleted_at IS NULL/s);
  assert.match(buildDashboardHighValueSamplesQuery(), /WHERE s\.deleted_at IS NULL AND s\.is_high_value = true/s);
  assert.match(buildDashboardTrackDistributionQuery(), /FROM samples s[\s\S]*WHERE s\.deleted_at IS NULL[\s\S]*GROUP BY/s);
  assert.match(buildDashboardContentTypeDistributionQuery(), /FROM samples s[\s\S]*WHERE s\.deleted_at IS NULL[\s\S]*GROUP BY/s);
  assert.match(buildDashboardRecentSamplesQuery(), /FROM samples s[\s\S]*WHERE s\.deleted_at IS NULL[\s\S]*ORDER BY s\.created_at DESC/s);
  assert.match(buildDashboardTopReferencesQuery(), /INNER JOIN samples s ON s\.id = tr\.sample_id[\s\S]*WHERE s\.deleted_at IS NULL[\s\S]*GROUP BY/s);
});
