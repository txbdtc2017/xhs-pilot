import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readMigration(name: string): string {
  return readFileSync(path.join(process.cwd(), 'migrations', name), 'utf8');
}

test('generation task lifecycle migration defines runtime metadata columns', () => {
  const migration = readMigration('025_add-generation-task-runtime-metadata.sql');

  assert.match(migration, /ALTER TABLE generation_tasks[\s\S]*ADD COLUMN IF NOT EXISTS current_step TEXT/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS stalled_at TIMESTAMPTZ/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS stalled_reason TEXT/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS failure_reason TEXT/i);
});
