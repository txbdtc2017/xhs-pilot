import { streamText } from 'ai';
import { llmGeneration } from '@/lib/llm';
import type { TaskInput } from './strategy';
import { GENERATION_SYSTEM_PROMPT } from './prompts/generation';
import type { StrategyResult } from './schemas/strategy';

export interface CoverCopy {
  main: string;
  sub?: string;
}

export interface GenerationOutput {
  titles: string[];
  openings: string[];
  body_versions: string[];
  cta_versions: string[];
  cover_copies: CoverCopy[];
  hashtags: string[];
  first_comment: string;
  image_suggestions: string;
}

export interface ReferenceContextInput {
  referenceType: 'title' | 'structure' | 'visual' | 'tone';
  promptBlock: string;
}

export interface GenerationPromptInput {
  taskInput: TaskInput;
  strategy: StrategyResult;
  referenceMode: 'zero-shot' | 'referenced';
  referenceBlocks: ReferenceContextInput[];
}

export interface GenerationDependencies {
  streamGenerationText: (params: {
    system: string;
    prompt: string;
    abortSignal?: AbortSignal;
  }) => ReturnType<typeof streamText>;
}

function extractSection(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) {
    throw new Error(`缺少必要章节：${heading}`);
  }

  const contentStart = markdown.indexOf('\n', start);
  const nextHeadingIndex = markdown.indexOf('\n## ', contentStart + 1);
  const rawSection =
    nextHeadingIndex >= 0
      ? markdown.slice(contentStart + 1, nextHeadingIndex)
      : markdown.slice(contentStart + 1);

  return rawSection.trim();
}

function parseNumberedLines(section: string): string[] {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
}

function parseCoverCopies(section: string): CoverCopy[] {
  const matches = [...section.matchAll(/\d+\.\s*主标题：(.+?)(?:\n\s*副标题：(.+))?(?=\n\d+\.|\s*$)/g)];
  return matches.map((match) => ({
    main: match[1].trim(),
    ...(match[2]?.trim() ? { sub: match[2].trim() } : {}),
  }));
}

function createDefaultGenerationDependencies(): GenerationDependencies {
  return {
    streamGenerationText: ({ system, prompt, abortSignal }) =>
      streamText({
        model: llmGeneration(process.env.LLM_MODEL_GENERATION || 'gpt-4o'),
        system,
        prompt,
        temperature: 0.7,
        maxRetries: 3,
        abortSignal,
      }),
  };
}

export function buildGenerationPrompt({
  taskInput,
  strategy,
  referenceMode,
  referenceBlocks,
}: GenerationPromptInput): string {
  const referenceSection =
    referenceMode === 'zero-shot'
      ? '参考模式：zero-shot\n没有可用的具体参考样本，请基于通用高互动逻辑生成。'
      : [
          '参考模式：referenced',
          '以下是按用途裁剪后的参考摘要，只能借鉴底层逻辑，不可复用原句。',
          ...referenceBlocks.map(
            (block, index) => `### 参考 ${index + 1}（${block.referenceType}）\n${block.promptBlock}`,
          ),
        ].join('\n\n');

  return [
    '请根据下面的任务与策略，输出最终的小红书创作结果。',
    `主题：${taskInput.topic}`,
    `目标人群：${taskInput.targetAudience ?? '未提供'}`,
    `目标效果：${taskInput.goal ?? '未提供'}`,
    `风格倾向：${taskInput.stylePreference ?? '未提供'}`,
    `persona_mode：${taskInput.personaMode ?? 'balanced'}`,
    `是否需要封面建议：${taskInput.needCoverSuggestion ?? true ? '是' : '否'}`,
    '',
    '创作策略：',
    `- 内容方向：${strategy.content_direction}`,
    `- 标题策略：${strategy.title_strategy}`,
    `- 开头策略：${strategy.opening_strategy ?? '未单独指定'}`,
    `- 结构策略：${strategy.structure_strategy}`,
    `- 封面策略：${strategy.cover_strategy ?? '未单独指定'}`,
    `- CTA 策略：${strategy.cta_strategy ?? '未单独指定'}`,
    `- 避免事项：${strategy.warnings?.join('；') ?? '无'}`,
    `- 策略总结：${strategy.strategy_summary}`,
    '',
    referenceSection,
    '',
    '请严格按照以下模板输出，不要增加额外说明：',
    '## 标题候选',
    '1. ...',
    '2. ...',
    '3. ...',
    '4. ...',
    '5. ...',
    '',
    '## 开头候选',
    '1. ...',
    '2. ...',
    '3. ...',
    '',
    '## 正文',
    '...',
    '',
    '## CTA 候选',
    '1. ...',
    '2. ...',
    '',
    '## 封面文案',
    '1. 主标题：...',
    '   副标题：...',
    '2. 主标题：...',
    '   副标题：...',
    '',
    '## 标签建议',
    '#标签1',
    '',
    '## 首评建议',
    '...',
    '',
    '## 配图建议',
    '...',
  ].join('\n');
}

export function parseGenerationOutput(markdown: string): GenerationOutput {
  const titles = parseNumberedLines(extractSection(markdown, '标题候选'));
  const openings = parseNumberedLines(extractSection(markdown, '开头候选'));
  const body = extractSection(markdown, '正文');
  const ctaVersions = parseNumberedLines(extractSection(markdown, 'CTA 候选'));
  const coverCopies = parseCoverCopies(extractSection(markdown, '封面文案'));
  const hashtags = extractSection(markdown, '标签建议')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'));
  const firstComment = extractSection(markdown, '首评建议');
  const imageSuggestions = extractSection(markdown, '配图建议');

  return {
    titles,
    openings,
    body_versions: [body],
    cta_versions: ctaVersions,
    cover_copies: coverCopies,
    hashtags,
    first_comment: firstComment,
    image_suggestions: imageSuggestions,
  };
}

export async function streamGeneratedMarkdown(
  input: GenerationPromptInput,
  dependencies: GenerationDependencies = createDefaultGenerationDependencies(),
): Promise<{
  fullText: string;
  parsed: GenerationOutput;
}> {
  const result = startGenerationTextStream(input, dependencies);

  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
  }

  return {
    fullText,
    parsed: parseGenerationOutput(fullText),
  };
}

export function startGenerationTextStream(
  input: GenerationPromptInput,
  dependencies: GenerationDependencies = createDefaultGenerationDependencies(),
  abortSignal?: AbortSignal,
) {
  return dependencies.streamGenerationText({
    system: GENERATION_SYSTEM_PROMPT,
    prompt: buildGenerationPrompt(input),
    abortSignal,
  });
}
