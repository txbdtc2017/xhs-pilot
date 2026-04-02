import { generateObject, jsonSchema } from 'ai';
import { llmAnalysis } from '@/lib/llm';
import { IMAGE_PLANNING_SYSTEM_PROMPT } from './prompts/image-planning';
import { imagePlanSchema, type ImagePlanResult, type ImagePlanVisualType } from './schemas/image-plan';

export interface ImagePlanningConfig {
  visualDirectionOverride: string | null;
  bodyPageCap: number;
  coverCandidateCount: number;
  bodyCandidateCount: number;
}

export interface ImagePlanningContext {
  task: {
    id: string;
    topic: string;
    target_audience: string | null;
    goal: string | null;
    style_preference: string | null;
    persona_mode: string | null;
    need_cover_suggestion: boolean | null;
  };
  strategy: Record<string, unknown> | null;
  references: Array<Record<string, unknown>>;
  output: Record<string, unknown>;
}

export interface PlannedImagePage {
  sortOrder: number;
  pageRole: 'cover' | 'body';
  isEnabled: boolean;
  contentPurpose: string;
  sourceExcerpt: string;
  visualType: ImagePlanVisualType;
  styleReason: string;
  promptSummary: string;
  promptText: string;
  candidateCount: number;
}

export interface PlannedImageResult {
  systemDecisionSummary: string;
  pages: PlannedImagePage[];
}

export interface ImagePlanningDependencies {
  generatePlanObject: (params: {
    system: string;
    prompt: string;
  }) => Promise<ImagePlanResult>;
}

function createDefaultImagePlanningDependencies(): ImagePlanningDependencies {
  return {
    generatePlanObject: async ({ system, prompt }) => {
      const { object } = await generateObject({
        model: llmAnalysis(process.env.LLM_MODEL_ANALYSIS || 'gpt-4o'),
        schema: jsonSchema<ImagePlanResult>(imagePlanSchema),
        system,
        prompt,
        temperature: 0.2,
        maxRetries: 3,
      });

      return object;
    },
  };
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value ?? null);
}

function takeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => stringifyValue(item)) : [];
}

export function buildImagePlanningPrompt({
  context,
  config,
}: {
  context: ImagePlanningContext;
  config: ImagePlanningConfig;
}): string {
  const strategy = context.strategy ?? {};
  const references = context.references.length > 0
    ? context.references.map((reference, index) => [
      `参考 ${index + 1}`,
      `- 类型：${stringifyValue(reference.reference_type)}`,
      `- 标题：${stringifyValue(reference.title)}`,
      `- 原因：${stringifyValue(reference.reason)}`,
      `- 视觉说明：${stringifyValue(reference.cover_explanation)}`,
      `- 标题规律：${stringifyValue(reference.title_pattern_explanation)}`,
      `- 结构规律：${stringifyValue(reference.structure_explanation)}`,
    ].join('\n')).join('\n\n')
    : '无参考样本，按 zero-shot 方式规划。';

  return [
    '请基于以下文本成稿结果生成结构化图片计划。',
    `主题：${context.task.topic}`,
    `目标人群：${context.task.target_audience ?? '未提供'}`,
    `目标效果：${context.task.goal ?? '未提供'}`,
    `风格倾向：${context.task.style_preference ?? '未提供'}`,
    `persona_mode：${context.task.persona_mode ?? 'balanced'}`,
    `视觉方向覆盖：${config.visualDirectionOverride ?? '未提供，请自行归纳'}`,
    `正文页上限：${config.bodyPageCap}`,
    `封面候选数：${config.coverCandidateCount}`,
    `正文候选数：${config.bodyCandidateCount}`,
    '',
    '文本输出：',
    `- 封面文案：${takeStringArray(context.output.cover_copies).join(' / ') || '未提供'}`,
    `- 正文：${takeStringArray(context.output.body_versions).join('\n\n') || '未提供'}`,
    `- 配图建议：${stringifyValue(context.output.image_suggestions)}`,
    '',
    '策略信息：',
    `- 策略总结：${stringifyValue(strategy.strategy_summary)}`,
    `- 封面策略：${stringifyValue(strategy.cover_strategy)}`,
    `- 结构策略：${stringifyValue(strategy.structure_strategy)}`,
    '',
    '参考信息：',
    references,
  ].join('\n');
}

function toVisualType(value: string): ImagePlanVisualType {
  return value === 'scene' ? 'scene' : 'info-card';
}

function sanitizeExcerpt(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 240) : fallback;
}

function normalizeGeneratedPlan(
  generated: ImagePlanResult,
  config: ImagePlanningConfig,
  context: ImagePlanningContext,
): PlannedImageResult {
  const rawPages = Array.isArray(generated.pages) ? generated.pages : [];
  const coverCopy = takeStringArray(context.output.cover_copies).join(' / ') || '封面主标题 + 副标题';
  const bodyText = takeStringArray(context.output.body_versions).join('\n\n') || '正文内容';

  const coverPage = rawPages.find((page) => page.page_role === 'cover') ?? {
    sort_order: 0,
    page_role: 'cover' as const,
    content_purpose: '封面结论页',
    source_excerpt: coverCopy,
    visual_type: 'info-card' as const,
    style_reason: config.visualDirectionOverride ?? '默认沿用封面结论表达',
    prompt_summary: config.visualDirectionOverride ?? '高对比、结论先行、强标题',
    prompt_text: `为小红书封面生成一张竖版图片，突出主标题与副标题，整体风格为：${config.visualDirectionOverride ?? '高对比结论封面'}。主标题与副标题参考：${coverCopy}`,
  };

  const bodyPages = rawPages
    .filter((page) => page.page_role === 'body')
    .slice(0, config.bodyPageCap)
    .map((page, index) => ({
      sortOrder: index + 1,
      pageRole: 'body' as const,
      isEnabled: true,
      contentPurpose: page.content_purpose.trim() || `正文第 ${index + 1} 页`,
      sourceExcerpt: sanitizeExcerpt(page.source_excerpt, bodyText.slice(0, 240)),
      visualType: toVisualType(page.visual_type),
      styleReason: page.style_reason.trim() || '承接正文信息表达',
      promptSummary: page.prompt_summary.trim() || '围绕正文要点生成视觉页',
      promptText: page.prompt_text.trim() || `为小红书正文生成一张竖版配图，围绕以下内容：${bodyText}`,
      candidateCount: config.bodyCandidateCount,
    }));

  const normalizedPages: PlannedImagePage[] = [
    {
      sortOrder: 0,
      pageRole: 'cover',
      isEnabled: true,
      contentPurpose: coverPage.content_purpose.trim() || '封面结论页',
      sourceExcerpt: sanitizeExcerpt(coverPage.source_excerpt, coverCopy),
      visualType: toVisualType(coverPage.visual_type),
      styleReason: coverPage.style_reason.trim() || (config.visualDirectionOverride ?? '承接封面结论表达'),
      promptSummary: coverPage.prompt_summary.trim() || '高对比、结论先行、强标题',
      promptText: coverPage.prompt_text.trim() || `为小红书封面生成一张竖版图片，文案参考：${coverCopy}`,
      candidateCount: config.coverCandidateCount,
    },
    ...bodyPages,
  ];

  if (normalizedPages.length === 1) {
    normalizedPages.push({
      sortOrder: 1,
      pageRole: 'body',
      isEnabled: true,
      contentPurpose: '正文要点页',
      sourceExcerpt: sanitizeExcerpt(bodyText, bodyText),
      visualType: 'info-card',
      styleReason: config.visualDirectionOverride ?? '默认提炼正文要点为信息卡',
      promptSummary: '提炼正文核心结论，适合做高信息密度正文图',
      promptText: `为小红书正文生成一张竖版信息卡，围绕以下内容提炼重点：${bodyText}`,
      candidateCount: config.bodyCandidateCount,
    });
  }

  return {
    systemDecisionSummary: generated.system_decision_summary.trim() || `正文适合 ${normalizedPages.length - 1} 页信息卡 + 1 页封面`,
    pages: normalizedPages,
  };
}

export async function generateImagePlan(
  {
    context,
    config,
  }: {
    context: ImagePlanningContext;
    config: ImagePlanningConfig;
  },
  dependencies: ImagePlanningDependencies = createDefaultImagePlanningDependencies(),
): Promise<PlannedImageResult> {
  const generated = await dependencies.generatePlanObject({
    system: IMAGE_PLANNING_SYSTEM_PROMPT,
    prompt: buildImagePlanningPrompt({ context, config }),
  });

  return normalizeGeneratedPlan(generated, config, context);
}
