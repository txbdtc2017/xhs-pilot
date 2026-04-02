import assert from 'node:assert/strict';
import test from 'node:test';

import { createImagePlanJobsPostHandler } from './route';

test('POST /api/image-plans/[planId]/jobs creates a queued image job and returns the events url', async () => {
  const queuedJobs: Array<{ name: string; payload: unknown }> = [];

  const POST = createImagePlanJobsPostHandler({
    getImageCapabilityStatus: (_env, provider) => {
      assert.equal(provider, 'openai');
      return { provider, available: true, model: 'gpt-image-1' };
    },
    getImagePlanDetail: async (planId) => {
      assert.equal(planId, 'plan-1');
      return {
        plan: {
          id: 'plan-1',
          output_id: 'output-1',
          status: 'ready',
          provider: 'openai',
          provider_model: 'gpt-image-1',
          visual_direction_override: null,
          body_page_cap: 4,
          cover_candidate_count: 2,
          body_candidate_count: 1,
          system_decision_summary: '摘要',
          created_at: '2026-03-31T00:00:00.000Z',
          superseded_at: null,
        },
        pages: [
          {
            id: 'page-cover',
            plan_id: 'plan-1',
            sort_order: 0,
            page_role: 'cover',
            is_enabled: true,
            content_purpose: '封面页',
            source_excerpt: '封面主标题',
            visual_type: 'info-card',
            style_reason: '高对比大字',
            prompt_summary: '摘要',
            prompt_text: 'prompt',
            candidate_count: 2,
          },
        ],
        assets: [],
        selected_assets: [],
      };
    },
    getActiveImageJob: async () => null,
    createImageJob: async (input) => {
      assert.deepEqual(input, {
        planId: 'plan-1',
        scope: 'full',
        planPageId: null,
        provider: 'openai',
        modelName: 'gpt-image-1',
      });
      return {
        id: 'job-1',
        plan_id: 'plan-1',
        scope: 'full',
        plan_page_id: null,
        provider: 'openai',
        status: 'queued',
        total_units: 0,
        completed_units: 0,
        error_message: null,
        model_name: 'gpt-image-1',
        created_at: '2026-03-31T00:00:00.000Z',
        started_at: null,
        finished_at: null,
      };
    },
    appendImageJobEvent: async (jobId, eventName, payload) => {
      assert.equal(jobId, 'job-1');
      assert.equal(eventName, 'job_queued');
      assert.deepEqual(payload, { job_id: 'job-1', scope: 'full' });
      return {
        id: 1,
        job_id: 'job-1',
        event_name: 'job_queued',
        payload,
        created_at: '2026-03-31T00:00:00.000Z',
      };
    },
    enqueueImageJob: async (jobId) => {
      queuedJobs.push({ name: 'generate', payload: { jobId } });
    },
  });

  const response = await POST(
    new Request('http://localhost/api/image-plans/plan-1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'full' }),
    }),
    { params: Promise.resolve({ planId: 'plan-1' }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    job: {
      id: 'job-1',
      plan_id: 'plan-1',
      scope: 'full',
      plan_page_id: null,
      status: 'queued',
      total_units: 0,
      completed_units: 0,
    },
    events_url: '/api/image-jobs/job-1/events',
  });
  assert.deepEqual(queuedJobs, [{ name: 'generate', payload: { jobId: 'job-1' } }]);
});

test('POST /api/image-plans/[planId]/jobs rejects concurrent active jobs for the same plan', async () => {
  const POST = createImagePlanJobsPostHandler({
    getImageCapabilityStatus: (_env, provider) => ({ provider, available: true, model: 'gpt-image-1' }),
    getImagePlanDetail: async () => ({
      plan: {
        id: 'plan-1',
        output_id: 'output-1',
        status: 'ready',
        provider: 'openai',
        provider_model: 'gpt-image-1',
        visual_direction_override: null,
        body_page_cap: 4,
        cover_candidate_count: 2,
        body_candidate_count: 1,
        system_decision_summary: '摘要',
        created_at: '2026-03-31T00:00:00.000Z',
        superseded_at: null,
      },
      pages: [],
      assets: [],
      selected_assets: [],
    }),
    getActiveImageJob: async () => ({
      id: 'job-running',
      plan_id: 'plan-1',
      scope: 'full',
      plan_page_id: null,
      provider: 'openai',
      status: 'running',
      total_units: 2,
      completed_units: 1,
      error_message: null,
      model_name: 'gpt-image-1',
      created_at: '2026-03-31T00:00:00.000Z',
      started_at: '2026-03-31T00:00:01.000Z',
      finished_at: null,
    }),
    createImageJob: async () => {
      throw new Error('should not run');
    },
    appendImageJobEvent: async () => {
      throw new Error('should not run');
    },
    enqueueImageJob: async () => {
      throw new Error('should not run');
    },
  });

  const response = await POST(
    new Request('http://localhost/api/image-plans/plan-1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'full' }),
    }),
    { params: Promise.resolve({ planId: 'plan-1' }) },
  );

  assert.equal(response.status, 409);
});
