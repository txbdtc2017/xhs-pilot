import { generateObject, jsonSchema } from 'ai';
import { llmAnalysis } from '@/lib/llm';
import { IMAGE_PLANNING_SYSTEM_PROMPT } from './prompts/image-planning';
import { shouldUseTextStructuredOutputFallback } from './structured-output';
import {
  imagePlanSchema,
  type ImagePlanResult,
  type ImagePlanVisualType,
} from './schemas/image-plan';

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
  shouldUseTextFallback: () => boolean;
  generatePlanObject: (params: {
    system: string;
    prompt: string;
  }) => Promise<ImagePlanResult>;
  generatePlanText: (params: {
    system: string;
    prompt: string;
    context: ImagePlanningContext;
    config: ImagePlanningConfig;
  }) => Promise<ImagePlanResult>;
}

function createDefaultImagePlanningDependencies(): ImagePlanningDependencies {
  return {
    shouldUseTextFallback: () => shouldUseTextStructuredOutputFallback(),
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
    generatePlanText: async ({ context, config }) => buildHeuristicImagePlan(context, config),
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

function splitSuggestionSegments(imageSuggestions: string): string[] {
  return imageSuggestions
    .split(/[；。\n]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function splitBodySections(bodyText: string): string[] {
  return bodyText
    .split(/\n-{3,}\n|\n\*\*(?=Day|\u5173\u4e8e|\u8def\u7ebf)/u)
    .map((segment) => segment.replace(/^\*\*|\*\*$/g, '').trim())
    .filter(Boolean);
}

function cleanInstructionLabel(instruction: string): string {
  return instruction
    .replace(/^(首图|第[一二三四五六七八九十\d]+张|封面)[:：]\s*/u, '')
    .trim();
}

function inferVisualType(instruction: string): ImagePlanVisualType {
  return /路线|时间轴|简图|信息卡|手绘/u.test(instruction) ? 'info-card' : 'scene';
}

function buildPromptText(instruction: string, visualType: ImagePlanVisualType): string {
  const baseStyle = '小红书竖版 3:4 构图，暖调，旅行编辑感，自然光，高级但不过度滤镜，无水印，无界面元素。';

  if (visualType === 'info-card') {
    return `${baseStyle} 生成一张旅行信息图/路线插画，核心内容围绕：${instruction}。允许少量大标题感文字，但不要密集小字。`;
  }

  return `${baseStyle} 生成一张旅行场景图，核心内容围绕：${instruction}，突出真实街景、食物或建筑氛围。`;
}

export function buildHeuristicImagePlan(
  context: ImagePlanningContext,
  config: ImagePlanningConfig,
): ImagePlanResult {
  const outputRecord = context.output as Record<string, unknown>;
  const coverCopy = takeStringArray(outputRecord.cover_copies).join(' / ') || '封面主标题 + 副标题';
  const bodyText = takeStringArray(outputRecord.body_versions).join('\n\n') || '正文内容';
  const imageSuggestions = stringifyValue(outputRecord.image_suggestions);
  const suggestionSegments = splitSuggestionSegments(imageSuggestions);
  const coverInstruction = cleanInstructionLabel(suggestionSegments[0] ?? `封面围绕 ${coverCopy}`);
  const bodyInstructions = suggestionSegments
    .slice(1)
    .map((segment) => cleanInstructionLabel(segment))
    .filter(Boolean);
  const bodySections = splitBodySections(bodyText);

  const pages: ImagePlanResult['pages'] = [
    {
      sort_order: 0,
      page_role: 'cover',
      content_purpose: '封面吸引点击',
      source_excerpt: sanitizeExcerpt(coverInstruction, coverCopy),
      visual_type: inferVisualType(coverInstruction),
      style_reason: '封面优先承接现成的配图建议和封面文案，减少二次理解偏差。',
      prompt_summary: coverInstruction.slice(0, 80),
      prompt_text: buildPromptText(coverInstruction, inferVisualType(coverInstruction)),
    },
  ];

  const desiredBodyCount = Math.max(1, config.bodyPageCap);
  for (let index = 0; index < desiredBodyCount; index += 1) {
    const instruction = bodyInstructions[index]
      ?? cleanInstructionLabel(bodySections[index] ?? `正文第 ${index + 1} 页，围绕 ${context.task.topic}`);
    const visualType = inferVisualType(instruction);
    pages.push({
      sort_order: index + 1,
      page_role: 'body',
      content_purpose: `正文第 ${index + 1} 页`,
      source_excerpt: sanitizeExcerpt(
        instruction,
        bodySections[index] ?? bodyText.slice(0, 240),
      ),
      visual_type: visualType,
      style_reason: visualType === 'info-card'
        ? '该页更适合提炼路线或信息密度较高的内容。'
        : '该页更适合承接场景、食物或街区氛围。',
      prompt_summary: instruction.slice(0, 80),
      prompt_text: buildPromptText(instruction, visualType),
    });
  }

  return {
    system_decision_summary: `启发式图片规划：1 页封面 + ${pages.length - 1} 页正文，优先复用成稿里的配图建议。`,
    pages,
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
  const generated = await (dependencies.shouldUseTextFallback()
    ? dependencies.generatePlanText({
      system: IMAGE_PLANNING_SYSTEM_PROMPT,
      prompt: buildImagePlanningPrompt({ context, config }),
      context,
      config,
    })
    : dependencies.generatePlanObject({
      system: IMAGE_PLANNING_SYSTEM_PROMPT,
      prompt: buildImagePlanningPrompt({ context, config }),
    }));

  return normalizeGeneratedPlan(generated, config, context);
}
