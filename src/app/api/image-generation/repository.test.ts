import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createImageGenerationRepository } from './repository';

function readMigration(name: string): string {
  return readFileSync(path.join(process.cwd(), 'migrations', name), 'utf8');
}

test('image generation migrations define the required tables and constraints', () => {
  const plansMigration = readMigration('018_create-image-plans.sql');
  const planPagesMigration = readMigration('019_create-image-plan-pages.sql');
  const jobsMigration = readMigration('020_create-image-generation-jobs.sql');
  const assetsMigration = readMigration('021_create-image-assets.sql');
  const eventsMigration = readMigration('022_create-image-job-events.sql');
  const constraintsMigration = readMigration('023_add-image-generation-constraints.sql');
  const providerMigration = readMigration('024_add-image-provider-columns.sql');

  assert.match(plansMigration, /CREATE TABLE IF NOT EXISTS image_plans/i);
  assert.match(plansMigration, /output_id UUID NOT NULL REFERENCES generation_outputs\(id\) ON DELETE CASCADE/i);
  assert.match(planPagesMigration, /CREATE TABLE IF NOT EXISTS image_plan_pages/i);
  assert.match(jobsMigration, /CREATE TABLE IF NOT EXISTS image_generation_jobs/i);
  assert.match(assetsMigration, /CREATE TABLE IF NOT EXISTS image_assets/i);
  assert.match(eventsMigration, /CREATE TABLE IF NOT EXISTS image_job_events/i);
  assert.match(constraintsMigration, /UNIQUE\s*\(task_id,\s*version\)/i);
  assert.match(constraintsMigration, /image_plan_pages_plan_id_sort_order_key[\s\S]*UNIQUE \(plan_id, sort_order\)/i);
  assert.match(constraintsMigration, /image_assets_job_id_plan_page_id_candidate_index_key[\s\S]*UNIQUE \(job_id, plan_page_id, candidate_index\)/i);
  assert.match(constraintsMigration, /superseded_at IS NULL/i);
  assert.match(constraintsMigration, /is_selected = TRUE/i);
  assert.match(providerMigration, /ALTER TABLE image_plans[\s\S]*ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai'/i);
  assert.match(providerMigration, /ALTER TABLE image_generation_jobs[\s\S]*ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai'/i);
});

test('replaceImagePlan supersedes previous active plans and inserts the new plan pages', async () => {
  const calls: Array<{ kind: 'query' | 'queryOne'; text: string; params?: unknown[] }> = [];

  const repository = createImageGenerationRepository({
    query: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'query', text, params });
      return [] as T[];
    },
    queryOne: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'queryOne', text, params });

      if (text.includes('INSERT INTO image_plans')) {
        return {
          id: 'plan-1',
          output_id: 'output-1',
          status: 'ready',
          provider: 'google_vertex',
          provider_model: 'gemini-3-pro-image-preview',
          visual_direction_override: '档案感结论大字',
          body_page_cap: 4,
          cover_candidate_count: 2,
          body_candidate_count: 1,
          system_decision_summary: '正文适合 2 页信息卡 + 1 页封面',
          created_at: '2026-03-31T00:00:00.000Z',
          superseded_at: null,
        } as T;
      }

      if (text.includes('INSERT INTO image_plan_pages')) {
        const sortOrder = Number(params?.[1]);
        const pageId = sortOrder === 0 ? 'page-cover' : 'page-body-1';

        return {
          id: pageId,
          plan_id: 'plan-1',
          sort_order: sortOrder,
          page_role: sortOrder === 0 ? 'cover' : 'body',
          is_enabled: params?.[3],
          content_purpose: params?.[4],
          source_excerpt: params?.[5],
          visual_type: params?.[6],
          style_reason: params?.[7],
          prompt_summary: params?.[8],
          prompt_text: params?.[9],
          candidate_count: params?.[10],
          created_at: '2026-03-31T00:00:00.000Z',
        } as T;
      }

      return null;
    },
  });

  const detail = await repository.replaceImagePlan({
    outputId: 'output-1',
    provider: 'google_vertex',
    providerModel: 'gemini-3-pro-image-preview',
    visualDirectionOverride: '档案感结论大字',
    bodyPageCap: 4,
    coverCandidateCount: 2,
    bodyCandidateCount: 1,
    systemDecisionSummary: '正文适合 2 页信息卡 + 1 页封面',
    pages: [
      {
        sortOrder: 0,
        pageRole: 'cover',
        isEnabled: true,
        contentPurpose: '封面结论页',
        sourceExcerpt: '封面主标题 + 副标题',
        visualType: 'info-card',
        styleReason: '高对比大字结论',
        promptSummary: '高对比、结论先行、强标题',
        promptText: '完整封面 prompt',
        candidateCount: 2,
      },
      {
        sortOrder: 1,
        pageRole: 'body',
        isEnabled: true,
        contentPurpose: '正文要点页',
        sourceExcerpt: '正文第一部分',
        visualType: 'scene',
        styleReason: '需要场景化辅助',
        promptSummary: '克制场景、轻文本',
        promptText: '完整正文 prompt',
        candidateCount: 1,
      },
    ],
  });

  assert.equal(detail.plan.id, 'plan-1');
  assert.equal(detail.plan.provider, 'google_vertex');
  assert.equal(detail.plan.provider_model, 'gemini-3-pro-image-preview');
  assert.equal(detail.pages.length, 2);
  assert.equal(
    calls.some(
      ({ text, params }) =>
        text.includes('UPDATE image_plans') &&
        text.includes('superseded_at = NOW()') &&
        params?.[0] === 'output-1',
    ),
    true,
  );
  assert.equal(
    calls.filter(({ text }) => text.includes('INSERT INTO image_plan_pages')).length,
    2,
  );
});

test('getImageJobSnapshot returns job state with plan pages and selected assets', async () => {
  const repository = createImageGenerationRepository({
    query: async <T>(text: string, params?: unknown[]) => {
      assert.equal(params?.[0], 'job-1');

      if (text.includes('FROM image_plan_pages')) {
        return [
          {
            id: 'page-cover',
            sort_order: 0,
            page_role: 'cover',
            is_enabled: true,
            candidate_count: 2,
          },
        ] as T[];
      }

      if (text.includes('FROM image_assets')) {
        return [
          {
            id: 'asset-1',
            plan_page_id: 'page-cover',
            image_url: '/uploads/generated/asset-1.png',
            candidate_index: 1,
            is_selected: true,
          },
        ] as T[];
      }

      return [] as T[];
    },
    queryOne: async <T>(text: string, params?: unknown[]) => {
      assert.equal(params?.[0], 'job-1');

      if (text.includes('FROM image_generation_jobs')) {
        return {
          id: 'job-1',
          plan_id: 'plan-1',
          scope: 'full',
          plan_page_id: null,
          provider: 'google_vertex',
          status: 'running',
          total_units: 2,
          completed_units: 1,
          error_message: null,
          model_name: 'gpt-image-1',
          created_at: '2026-03-31T00:00:00.000Z',
          started_at: '2026-03-31T00:00:05.000Z',
          finished_at: null,
          plan_status: 'ready',
          output_id: 'output-1',
          plan_provider: 'google_vertex',
          plan_provider_model: 'gemini-3-pro-image-preview',
        } as T;
      }

      return null;
    },
  });

  const snapshot = await repository.getImageJobSnapshot('job-1');

  assert.deepEqual(snapshot, {
    job: {
      id: 'job-1',
      plan_id: 'plan-1',
      scope: 'full',
      plan_page_id: null,
      provider: 'google_vertex',
      status: 'running',
      total_units: 2,
      completed_units: 1,
      error_message: null,
      model_name: 'gpt-image-1',
      created_at: '2026-03-31T00:00:00.000Z',
      started_at: '2026-03-31T00:00:05.000Z',
      finished_at: null,
    },
    plan: {
      id: 'plan-1',
      output_id: 'output-1',
      status: 'ready',
      provider: 'google_vertex',
      provider_model: 'gemini-3-pro-image-preview',
    },
    pages: [
      {
        id: 'page-cover',
        sort_order: 0,
        page_role: 'cover',
        is_enabled: true,
        candidate_count: 2,
      },
    ],
    assets: [
      {
        id: 'asset-1',
        plan_page_id: 'page-cover',
        image_url: '/uploads/generated/asset-1.png',
        candidate_index: 1,
        is_selected: true,
      },
    ],
    selected_assets: [
      {
        id: 'asset-1',
        plan_page_id: 'page-cover',
        image_url: '/uploads/generated/asset-1.png',
        candidate_index: 1,
        is_selected: true,
      },
    ],
  });
});

test('selectImageAsset clears sibling selections before marking the target asset selected', async () => {
  const calls: Array<{ kind: 'query' | 'queryOne'; text: string; params?: unknown[] }> = [];

  const repository = createImageGenerationRepository({
    query: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'query', text, params });
      return [] as T[];
    },
    queryOne: async <T>(text: string, params?: unknown[]) => {
      calls.push({ kind: 'queryOne', text, params });

      if (text.includes('SELECT id, plan_page_id') && text.includes('FROM image_assets')) {
        return {
          id: 'asset-2',
          plan_page_id: 'page-2',
        } as T;
      }

      if (text.includes('UPDATE image_assets') && text.includes('RETURNING')) {
        return {
          id: 'asset-2',
          plan_page_id: 'page-2',
          image_url: '/uploads/generated/asset-2.png',
          is_selected: true,
        } as T;
      }

      return null;
    },
  });

  const asset = await repository.selectImageAsset('asset-2');

  assert.deepEqual(asset, {
    id: 'asset-2',
    plan_page_id: 'page-2',
    image_url: '/uploads/generated/asset-2.png',
    is_selected: true,
  });
  assert.equal(
    calls.some(
      ({ text, params }) =>
        text.includes('SET is_selected = FALSE') &&
        params?.[0] === 'page-2',
    ),
    true,
  );
});
