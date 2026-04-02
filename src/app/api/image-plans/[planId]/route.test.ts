import assert from 'node:assert/strict';
import test from 'node:test';

import { createImagePlanPatchHandler } from './route';

test('PATCH /api/image-plans/[planId] replans prompt content when the visual direction changes', async () => {
  const PATCH = createImagePlanPatchHandler({
    getImagePlanDetail: async (planId) => {
      assert.equal(planId, 'plan-1');
      return {
        plan: {
          id: 'plan-1',
          output_id: 'output-1',
          status: 'ready',
          visual_direction_override: null,
          body_page_cap: 4,
          cover_candidate_count: 2,
          body_candidate_count: 1,
          system_decision_summary: '旧摘要',
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
            content_purpose: '封面结论页',
            source_excerpt: '封面主标题 + 副标题',
            visual_type: 'info-card',
            style_reason: '旧风格',
            prompt_summary: '旧摘要',
            prompt_text: '旧 prompt',
            candidate_count: 2,
          },
        ],
        assets: [],
        selected_assets: [],
      };
    },
    hasAnyJobsForPlan: async () => false,
    getOutputPlanningContext: async (outputId) => {
      assert.equal(outputId, 'output-1');
      return {
        task: { id: 'task-1', topic: '主题一', target_audience: '职场人', goal: '收藏', style_preference: null, persona_mode: 'balanced', need_cover_suggestion: true },
        strategy: { strategy_summary: '策略摘要' },
        references: [],
        output: {
          id: 'output-1',
          task_id: 'task-1',
          version: 1,
          created_at: '2026-03-31T00:00:00.000Z',
          cover_copies: [{ main: '封面主标题', sub: '封面副标题' }],
          body_versions: ['正文第一段'],
          image_suggestions: '做成信息卡',
        },
      };
    },
    generateImagePlan: async ({ config }) => {
      assert.equal(config.visualDirectionOverride, '杂志感留白版');
      return {
        systemDecisionSummary: '新摘要',
        pages: [
          {
            sortOrder: 0,
            pageRole: 'cover',
            isEnabled: true,
            contentPurpose: '封面结论页',
            sourceExcerpt: '封面主标题 + 副标题',
            visualType: 'info-card',
            styleReason: '新风格',
            promptSummary: '新摘要',
            promptText: '新 prompt',
            candidateCount: 2,
          },
        ],
      };
    },
    updateImagePlan: async (planId, input) => {
      assert.equal(planId, 'plan-1');
      assert.equal(input.visualDirectionOverride, '杂志感留白版');
      return {
        plan: {
          id: 'plan-1',
          output_id: 'output-1',
          status: 'ready',
          visual_direction_override: '杂志感留白版',
          body_page_cap: 4,
          cover_candidate_count: 2,
          body_candidate_count: 1,
          system_decision_summary: '新摘要',
          created_at: '2026-03-31T00:00:00.000Z',
          superseded_at: null,
        },
        pages: [
          {
            id: 'page-cover-2',
            plan_id: 'plan-1',
            sort_order: 0,
            page_role: 'cover',
            is_enabled: false,
            content_purpose: '封面结论页',
            source_excerpt: '封面主标题 + 副标题',
            visual_type: 'info-card',
            style_reason: '新风格',
            prompt_summary: '新摘要',
            prompt_text: '新 prompt',
            candidate_count: 2,
          },
        ],
        assets: [],
        selected_assets: [],
      };
    },
    setImagePlanPageEnabledStates: async () => {
      throw new Error('should not run');
    },
  });

  const response = await PATCH(
    new Request('http://localhost/api/image-plans/plan-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visualDirectionOverride: '杂志感留白版',
        pages: [{ id: 'page-cover', isEnabled: false }],
      }),
    }),
    { params: Promise.resolve({ planId: 'plan-1' }) },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.visual_direction_override, '杂志感留白版');
  assert.equal(payload.pages[0]?.is_enabled, false);
});

test('PATCH /api/image-plans/[planId] refuses to mutate a plan once jobs exist', async () => {
  const PATCH = createImagePlanPatchHandler({
    getImagePlanDetail: async () => ({
      plan: {
        id: 'plan-1',
        output_id: 'output-1',
        status: 'ready',
        visual_direction_override: null,
        body_page_cap: 4,
        cover_candidate_count: 2,
        body_candidate_count: 1,
        system_decision_summary: '旧摘要',
        created_at: '2026-03-31T00:00:00.000Z',
        superseded_at: null,
      },
      pages: [],
      assets: [],
      selected_assets: [],
    }),
    hasAnyJobsForPlan: async () => true,
    getOutputPlanningContext: async () => null,
    generateImagePlan: async () => {
      throw new Error('should not run');
    },
    updateImagePlan: async () => null,
    setImagePlanPageEnabledStates: async () => null,
  });

  const response = await PATCH(
    new Request('http://localhost/api/image-plans/plan-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: [] }),
    }),
    { params: Promise.resolve({ planId: 'plan-1' }) },
  );

  assert.equal(response.status, 409);
});
