import assert from 'node:assert/strict';
import test from 'node:test';

import { generateImagePlan, type ImagePlanningContext } from './image-planning';
import type { ImagePlanResult } from './schemas/image-plan';

function createPlanningContext(): ImagePlanningContext {
  return {
    task: {
      id: 'task-1',
      topic: '泉州两天一夜城市漫游攻略',
      target_audience: '周末短途旅行用户',
      goal: '收藏',
      style_preference: '像本地朋友带路',
      persona_mode: 'balanced',
      need_cover_suggestion: true,
    },
    strategy: {
      strategy_summary: '按时间轴拆解路线',
      cover_strategy: '结论先行',
      structure_strategy: 'Day1/Day2 双日程',
    },
    references: [],
    output: {
      cover_copies: [
        { main: '2天1夜｜全程步行', sub: '泉州老城散步地图' },
      ],
      body_versions: [
        'Day 1 先走西街，Day 2 再去城南。',
      ],
      image_suggestions: '首图做三拼，正文做路线卡。',
    },
  };
}

function createGeneratedPlan(): ImagePlanResult {
  return {
    system_decision_summary: '1 页封面 + 1 页路线信息卡',
    pages: [
      {
        sort_order: 0,
        page_role: 'cover',
        content_purpose: '封面结论页',
        source_excerpt: '2天1夜｜全程步行 / 泉州老城散步地图',
        visual_type: 'info-card',
        style_reason: '封面用高对比标题更适合小红书点击',
        prompt_summary: '三拼封面，标题醒目',
        prompt_text: '生成一张泉州旅行攻略封面，三拼布局，暖调。',
      },
      {
        sort_order: 1,
        page_role: 'body',
        content_purpose: '路线总览页',
        source_excerpt: 'Day 1 先走西街，Day 2 再去城南。',
        visual_type: 'info-card',
        style_reason: '正文更适合用信息卡交代路线',
        prompt_summary: '行程信息卡',
        prompt_text: '生成一张泉州两天路线信息卡，标记西街和城南。',
      },
    ],
  };
}

test('generateImagePlan uses text structured-output fallback when direct object mode is disabled', async () => {
  let textFallbackCalled = false;

  const result = await generateImagePlan(
    {
      context: createPlanningContext(),
      config: {
        visualDirectionOverride: null,
        bodyPageCap: 4,
        coverCandidateCount: 2,
        bodyCandidateCount: 1,
      },
    },
    {
      shouldUseTextFallback: () => true,
      generatePlanObject: async () => {
        throw new Error('generatePlanObject should not run');
      },
      generatePlanText: async () => {
        textFallbackCalled = true;
        return createGeneratedPlan();
      },
    },
  );

  assert.equal(textFallbackCalled, true);
  assert.equal(result.systemDecisionSummary, '1 页封面 + 1 页路线信息卡');
  assert.equal(result.pages[0].candidateCount, 2);
  assert.equal(result.pages[1].candidateCount, 1);
});
