import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createGenerationRepository } from './repository';

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

test('generation task migrations define hard-delete cascade chains for direct dependents and image records', () => {
  const taskReferences = readMigration('009_create-task-references.sql');
  const taskStrategy = readMigration('010_create-task-strategy.sql');
  const generationOutputs = readMigration('011_create-generation-outputs.sql');
  const taskFeedback = readMigration('012_create-task-feedback.sql');
  const imagePlans = readMigration('018_create-image-plans.sql');
  const imagePlanPages = readMigration('019_create-image-plan-pages.sql');
  const imageJobs = readMigration('020_create-image-generation-jobs.sql');
  const imageAssets = readMigration('021_create-image-assets.sql');
  const imageEvents = readMigration('022_create-image-job-events.sql');

  assert.match(taskReferences, /task_id\s+UUID REFERENCES generation_tasks\(id\) ON DELETE CASCADE/i);
  assert.match(taskStrategy, /task_id\s+UUID UNIQUE REFERENCES generation_tasks\(id\) ON DELETE CASCADE/i);
  assert.match(generationOutputs, /task_id\s+UUID REFERENCES generation_tasks\(id\) ON DELETE CASCADE/i);
  assert.match(taskFeedback, /task_id\s+UUID REFERENCES generation_tasks\(id\) ON DELETE CASCADE/i);
  assert.match(imagePlans, /output_id UUID NOT NULL REFERENCES generation_outputs\(id\) ON DELETE CASCADE/i);
  assert.match(imagePlanPages, /plan_id UUID NOT NULL REFERENCES image_plans\(id\) ON DELETE CASCADE/i);
  assert.match(imageJobs, /plan_id UUID NOT NULL REFERENCES image_plans\(id\) ON DELETE CASCADE/i);
  assert.match(imageAssets, /plan_page_id UUID NOT NULL REFERENCES image_plan_pages\(id\) ON DELETE CASCADE/i);
  assert.match(imageAssets, /job_id UUID NOT NULL REFERENCES image_generation_jobs\(id\) ON DELETE CASCADE/i);
  assert.match(imageEvents, /job_id UUID NOT NULL REFERENCES image_generation_jobs\(id\) ON DELETE CASCADE/i);
});

test('hardDeleteTask deletes a completed task and relies on FK cascades', async () => {
  const calls: Array<{ kind: 'query' | 'queryOne'; text: string; params?: unknown[] }> = [];
  const repository = createGenerationRepository({
    query: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'query', text, params });
      return [] as T[];
    },
    queryOne: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'queryOne', text, params });

      if (text.includes('FROM generation_tasks gt')) {
        return {
          task_status: 'completed',
          active_image_job_status: null,
        } as T;
      }

      if (text.includes('DELETE FROM generation_tasks')) {
        return { id: 'task-1' } as T;
      }

      return null;
    },
    imageGenerationRepository: {
      listOutputVersions: async () => [],
      getLatestImagePlanForOutput: async () => null,
      getActiveImageJob: async () => null,
    },
  });

  const result = await repository.hardDeleteTask('task-1');

  assert.deepEqual(result, { code: 'deleted' });
  assert.equal(
    calls.some(
      ({ text, params }) =>
        text.includes('DELETE FROM generation_tasks') &&
        params?.[0] === 'task-1',
    ),
    true,
  );
  assert.equal(
    calls.some(({ text }) => text.includes('DELETE FROM generation_outputs')),
    false,
  );
  assert.equal(
    calls.some(({ text }) => text.includes('DELETE FROM image_plans')),
    false,
  );
});

test('hardDeleteTask returns not_found when the generation task does not exist', async () => {
  const repository = createGenerationRepository({
    query: async () => [],
    queryOne: async () => null,
    imageGenerationRepository: {
      listOutputVersions: async () => [],
      getLatestImagePlanForOutput: async () => null,
      getActiveImageJob: async () => null,
    },
  });

  const result = await repository.hardDeleteTask('missing-task');

  assert.deepEqual(result, { code: 'not_found' });
});

test('hardDeleteTask rejects non-terminal text tasks', async () => {
  const repository = createGenerationRepository({
    query: async () => [],
    queryOne: async <T>() => ({
      task_status: 'running',
      active_image_job_status: null,
    } as T),
    imageGenerationRepository: {
      listOutputVersions: async () => [],
      getLatestImagePlanForOutput: async () => null,
      getActiveImageJob: async () => null,
    },
  });

  const result = await repository.hardDeleteTask('task-1');

  assert.deepEqual(result, { code: 'task_active' });
});

test('hardDeleteTask rejects terminal tasks that still have active image jobs', async () => {
  const repository = createGenerationRepository({
    query: async () => [],
    queryOne: async <T>() => ({
      task_status: 'failed',
      active_image_job_status: 'queued',
    } as T),
    imageGenerationRepository: {
      listOutputVersions: async () => [],
      getLatestImagePlanForOutput: async () => null,
      getActiveImageJob: async () => null,
    },
  });

  const result = await repository.hardDeleteTask('task-1');

  assert.deepEqual(result, { code: 'image_job_active' });
});

test('getTaskHistory reconciles stale running tasks to failed and unlocks deletion', async () => {
  const calls: Array<{ kind: 'query' | 'queryOne'; text: string; params?: unknown[] }> = [];
  const repository = createGenerationRepository({
    query: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'query', text, params });

      if (text.includes('FROM generation_tasks gt')) {
        return [
          {
            id: 'task-stale',
            topic: '卡死任务',
            status: 'running',
            reference_mode: 'referenced',
            created_at: '2026-04-04T10:00:00.000Z',
            current_step: 'generating',
            started_at: '2026-04-04T10:00:00.000Z',
            last_progress_at: '2026-04-04T10:00:00.000Z',
            last_heartbeat_at: '2026-04-04T10:00:00.000Z',
            stalled_at: null,
            failed_at: null,
            stalled_reason: null,
            failure_reason: null,
            has_active_image_jobs: false,
          },
        ] as T[];
      }

      return [] as T[];
    },
    queryOne: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'queryOne', text, params });

      if (text.includes('COUNT(*)::int AS total')) {
        return { total: 1 } as T;
      }

      return null;
    },
    imageGenerationRepository: {
      listOutputVersions: async () => [],
      getLatestImagePlanForOutput: async () => null,
      getActiveImageJob: async () => null,
    },
    now: () => '2026-04-04T10:05:01.000Z',
  });

  const result = await repository.getTaskHistory({ page: 1, limit: 8 });

  assert.deepEqual(result, {
    tasks: [
      {
        id: 'task-stale',
        topic: '卡死任务',
        status: 'failed',
        reference_mode: 'referenced',
        created_at: '2026-04-04T10:00:00.000Z',
        can_delete: true,
      },
    ],
    total: 1,
  });
  assert.equal(
    calls.some(
      ({ text, params }) =>
        text.includes('UPDATE generation_tasks')
        && params?.[0] === 'task-stale'
        && params?.[1] === 'failed',
    ),
    true,
  );
});

test('hardDeleteTask reconciles stale running tasks before applying the delete guard', async () => {
  const calls: Array<{ kind: 'query' | 'queryOne'; text: string; params?: unknown[] }> = [];
  const repository = createGenerationRepository({
    query: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'query', text, params });
      return [] as T[];
    },
    queryOne: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'queryOne', text, params });

      if (text.includes('FROM generation_tasks gt')) {
        return {
          task_status: 'running',
          current_step: 'generating',
          started_at: '2026-04-04T10:00:00.000Z',
          last_progress_at: '2026-04-04T10:00:00.000Z',
          last_heartbeat_at: '2026-04-04T10:00:00.000Z',
          stalled_at: null,
          failed_at: null,
          stalled_reason: null,
          failure_reason: null,
          active_image_job_status: null,
        } as T;
      }

      if (text.includes('DELETE FROM generation_tasks')) {
        return { id: 'task-stale' } as T;
      }

      return null;
    },
    imageGenerationRepository: {
      listOutputVersions: async () => [],
      getLatestImagePlanForOutput: async () => null,
      getActiveImageJob: async () => null,
    },
    now: () => '2026-04-04T10:05:01.000Z',
  });

  const result = await repository.hardDeleteTask('task-stale');

  assert.deepEqual(result, { code: 'deleted' });
  assert.equal(
    calls.some(
      ({ text, params }) =>
        text.includes('UPDATE generation_tasks')
        && params?.[0] === 'task-stale'
        && params?.[1] === 'failed',
    ),
    true,
  );
});
