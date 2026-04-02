import assert from 'node:assert/strict';
import test from 'node:test';

import { createGenerateOutputImagePlansPostHandler } from './route';

test('POST /api/generate/outputs/[outputId]/image-plans creates a structured image plan for the selected output', async () => {
  const POST = createGenerateOutputImagePlansPostHandler({
    getImageCapabilityStatus: (_env, provider) => {
      assert.equal(provider, 'google_vertex');
      return { provider, available: true, model: 'gemini-3-pro-image-preview' };
    },
    getOutputPlanningContext: async (outputId) => {
      assert.equal(outputId, 'output-1');
      return {
        task: { id: 'task-1', topic: '主题一', target_audience: '职场人', goal: '收藏', style_preference: null, persona_mode: 'balanced', need_cover_suggestion: true },
        strategy: { strategy_summary: '策略摘要', cover_strategy: '结论大字封面' },
        references: [],
        output: {
          id: 'output-1',
          task_id: 'task-1',
          version: 1,
          created_at: '2026-03-31T00:00:00.000Z',
          cover_copies: [{ main: '封面主标题', sub: '封面副标题' }],
          body_versions: ['正文第一段'],
          image_suggestions: '做成高对比信息卡',
        },
      };
    },
    generateImagePlan: async ({ config }) => {
      assert.deepEqual(config, {
        visualDirectionOverride: '档案感结论大字',
        bodyPageCap: 4,
        coverCandidateCount: 2,
        bodyCandidateCount: 1,
      });
      return {
        systemDecisionSummary: '正文适合 2 页信息卡 + 1 页封面',
        pages: [
          {
            sortOrder: 0,
            pageRole: 'cover',
            isEnabled: true,
            contentPurpose: '封面结论页',
            sourceExcerpt: '封面主标题 + 副标题',
            visualType: 'info-card',
            styleReason: '高对比大字封面',
            promptSummary: '高对比、结论先行、强标题',
            promptText: '完整原始 prompt',
            candidateCount: 2,
          },
        ],
      };
    },
    replaceImagePlan: async (input) => {
      assert.equal(input.outputId, 'output-1');
      assert.equal(input.provider, 'google_vertex');
      assert.equal(input.providerModel, 'gemini-3-pro-image-preview');
      return {
        plan: {
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
            style_reason: '高对比大字封面',
            prompt_summary: '高对比、结论先行、强标题',
            prompt_text: '完整原始 prompt',
            candidate_count: 2,
          },
        ],
        assets: [],
        selected_assets: [],
      };
    },
  });

  const response = await POST(
    new Request('http://localhost/api/generate/outputs/output-1/image-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google_vertex',
        visualDirectionOverride: '档案感结论大字',
        bodyPageCap: 4,
        coverCandidateCount: 2,
        bodyCandidateCount: 1,
      }),
    }),
    { params: Promise.resolve({ outputId: 'output-1' }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    plan: {
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
        style_reason: '高对比大字封面',
        prompt_summary: '高对比、结论先行、强标题',
        prompt_text: '完整原始 prompt',
        candidate_count: 2,
      },
    ],
    selected_output: {
      id: 'output-1',
      task_id: 'task-1',
      version: 1,
      created_at: '2026-03-31T00:00:00.000Z',
    },
  });
});

test('POST /api/generate/outputs/[outputId]/image-plans validates request bounds and capability', async () => {
  const POST = createGenerateOutputImagePlansPostHandler({
    getImageCapabilityStatus: (_env, provider) => ({
      provider,
      available: false,
      code: 'IMAGE_UNCONFIGURED',
      message: '当前未配置图片生成能力，请补充 IMAGE_* 配置。',
      model: 'gpt-image-1',
    }),
    getOutputPlanningContext: async () => null,
    generateImagePlan: async () => {
      throw new Error('should not run');
    },
    replaceImagePlan: async () => {
      throw new Error('should not run');
    },
  });

  const capabilityResponse = await POST(
    new Request('http://localhost/api/generate/outputs/output-1/image-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', bodyPageCap: 4, coverCandidateCount: 2, bodyCandidateCount: 1 }),
    }),
    { params: Promise.resolve({ outputId: 'output-1' }) },
  );

  assert.equal(capabilityResponse.status, 409);

  const validationResponse = await createGenerateOutputImagePlansPostHandler({
    getImageCapabilityStatus: (_env, provider) => ({ provider, available: true, model: 'gpt-image-1' }),
    getOutputPlanningContext: async () => null,
    generateImagePlan: async () => {
      throw new Error('should not run');
    },
    replaceImagePlan: async () => {
      throw new Error('should not run');
    },
  })(
    new Request('http://localhost/api/generate/outputs/output-1/image-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', bodyPageCap: 9, coverCandidateCount: 2, bodyCandidateCount: 1 }),
    }),
    { params: Promise.resolve({ outputId: 'output-1' }) },
  );

  assert.equal(validationResponse.status, 400);
});
