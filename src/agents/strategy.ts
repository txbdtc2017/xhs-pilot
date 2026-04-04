import { embed, generateObject, jsonSchema, streamObject } from 'ai';
import {
  searchLexicalSamples,
  searchSimilarSamples,
  type SearchLexicalSamplesParams,
  type SearchSimilarSamplesParams,
  type SimilarSample,
} from '@/lib/db';
import { llmAnalysis, llmEmbedding } from '@/lib/llm';
import {
  DEFAULT_EMBEDDING_MODEL,
  resolveSearchModeStatus,
  type SearchMode,
  type SearchModeStatus,
} from '@/lib/search-mode';
import {
  STRATEGY_SYSTEM_PROMPT,
  TASK_UNDERSTANDING_SYSTEM_PROMPT,
} from './prompts/strategy';
import {
  createSingleObjectStream,
  generateStructuredJsonText,
  shouldUseTextStructuredOutputFallback,
} from './structured-output';
import { type StrategyResult, isStrategyResult, strategySchema } from './schemas/strategy';
import {
  isTaskUnderstandingResult,
  taskUnderstandingSchema,
  type TaskUnderstandingResult,
} from './schemas/task-understanding';

export interface TaskInput {
  topic: string;
  targetAudience?: string;
  goal?: string;
  stylePreference?: string;
  personaMode?: string;
  styleProfileId?: string;
  needCoverSuggestion?: boolean;
}

export type ReferenceMode = 'zero-shot' | 'referenced';
export type ReferenceType = 'title' | 'structure' | 'visual' | 'tone';

export interface SelectedTaskReference {
  sample_id: string;
  title: string;
  similarity: number;
  reference_type: ReferenceType;
  reason: string;
}

export interface TaskReferencesSelection {
  reference_mode: ReferenceMode;
  candidate_count: number;
  selected_references: SelectedTaskReference[];
}

export interface ReferenceContextBlock extends SelectedTaskReference {
  promptBlock: string;
}

export interface RetrieveTaskReferencesResult {
  searchMode: SearchMode;
  searchModeReason: string | null;
  referenceMode: ReferenceMode;
  similarSamples: SimilarSample[];
  taskUnderstanding: TaskUnderstandingResult;
  taskEmbedding: number[];
}

export interface StrategyDependencies {
  generateTaskUnderstanding: (params: {
    system: string;
    prompt: string;
    abortSignal?: AbortSignal;
  }) => Promise<TaskUnderstandingResult>;
  createTaskEmbedding: (query: string, abortSignal?: AbortSignal) => Promise<number[]>;
  searchSimilarSamples: (params: SearchSimilarSamplesParams) => Promise<SimilarSample[]>;
  searchLexicalSamples: (params: SearchLexicalSamplesParams) => Promise<SimilarSample[]>;
  getSearchModeStatus: () => SearchModeStatus;
}

export interface StreamStrategyDependencies {
  streamStrategyObject: (params: {
    system: string;
    prompt: string;
    input: {
      taskInput: TaskInput;
      taskUnderstanding: TaskUnderstandingResult;
      referenceSelection: TaskReferencesSelection;
      referenceBlocks: ReferenceContextBlock[];
    };
    abortSignal?: AbortSignal;
  }) => {
    partialObjectStream: AsyncIterable<Record<string, unknown>>;
    object: Promise<Record<string, unknown>>;
  };
}

export interface RetrieveTaskReferencesOptions {
  zeroShotThreshold?: number;
  limit?: number;
  topic?: string;
}

function buildTaskUnderstandingPrompt(input: TaskInput): string {
  return [
    '请先理解下面的小红书创作任务，并输出任务理解与检索参数。',
    `主题：${input.topic}`,
    `目标人群：${input.targetAudience ?? '未提供'}`,
    `目标效果：${input.goal ?? '未提供'}`,
    `风格倾向：${input.stylePreference ?? '未提供'}`,
    `persona_mode：${input.personaMode ?? 'balanced'}`,
    `指定画像：${input.styleProfileId ?? '未提供'}`,
    `是否需要封面建议：${input.needCoverSuggestion ?? true ? '是' : '否'}`,
  ].join('\n');
}

function buildTaskSummaryLines(taskUnderstanding: TaskUnderstandingResult): string[] {
  return [
    `任务类型：${taskUnderstanding.task_type}`,
    `建议结构：${taskUnderstanding.suitable_structure ?? '未提供'}`,
    `参考重点：${taskUnderstanding.reference_focus?.join('、') ?? '未提供'}`,
    `注意事项：${taskUnderstanding.notes ?? '未提供'}`,
    `检索目标：${taskUnderstanding.goal ?? '综合'}`,
  ];
}

function buildCompactStrategyFallbackPrompt(input: {
  taskInput: TaskInput;
  taskUnderstanding: TaskUnderstandingResult;
  referenceSelection: TaskReferencesSelection;
  referenceBlocks: ReferenceContextBlock[];
}): string {
  const compactReferences =
    input.referenceSelection.reference_mode === 'zero-shot'
      ? '参考模式：zero-shot，不要编造具体样本。'
      : [
          `参考模式：${input.referenceSelection.reference_mode}`,
          ...input.referenceBlocks.slice(0, 4).map(
            (block, index) => `参考${index + 1}：${block.reference_type} | ${block.promptBlock.replace(/\n+/g, ' / ')}`,
          ),
        ].join('\n');

  return [
    '请输出紧凑策略 JSON。',
    `主题：${input.taskInput.topic}`,
    `目标人群：${input.taskInput.targetAudience ?? '未提供'}`,
    `目标效果：${input.taskInput.goal ?? '未提供'}`,
    `风格倾向：${input.taskInput.stylePreference ?? '未提供'}`,
    `persona_mode：${input.taskInput.personaMode ?? 'balanced'}`,
    `任务类型：${input.taskUnderstanding.task_type}`,
    `建议结构：${input.taskUnderstanding.suitable_structure ?? '未提供'}`,
    `任务注意：${input.taskUnderstanding.notes ?? '未提供'}`,
    compactReferences,
    '输出要求：',
    '- 所有字段都尽量简短直接，一句中文即可。',
    '- warnings 最多 3 条。',
    '- cover_strategy 和 cta_strategy 可以简短，但不要省略。',
  ].join('\n');
}

function createDefaultStrategyDependencies(): StrategyDependencies {
  return {
    generateTaskUnderstanding: async ({ system, prompt, abortSignal }) => {
      const modelId = process.env.LLM_MODEL_ANALYSIS || 'gpt-4o';

      if (shouldUseTextStructuredOutputFallback()) {
        return generateStructuredJsonText({
          modelId,
          system,
          prompt,
          schema: taskUnderstandingSchema,
          validate: isTaskUnderstandingResult,
          label: '任务理解',
          temperature: 0,
          maxOutputTokens: 400,
          abortSignal,
        });
      }

      const { object } = await generateObject({
        model: llmAnalysis(modelId),
        schema: jsonSchema<TaskUnderstandingResult>(taskUnderstandingSchema),
        system,
        prompt,
        temperature: 0,
        maxRetries: 3,
        abortSignal,
      });

      return object;
    },
    createTaskEmbedding: async (query, abortSignal) => {
      const { embedding } = await embed({
        model: llmEmbedding.textEmbeddingModel(process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL),
        value: query,
        maxRetries: 3,
        abortSignal,
      });

      return embedding;
    },
    searchSimilarSamples,
    searchLexicalSamples,
    getSearchModeStatus: () => resolveSearchModeStatus(),
  };
}

function createDefaultStreamStrategyDependencies(): StreamStrategyDependencies {
  return {
    streamStrategyObject: ({ system, prompt, input, abortSignal }) => {
      const modelId = process.env.LLM_MODEL_ANALYSIS || 'gpt-4o';

      if (shouldUseTextStructuredOutputFallback()) {
        return createSingleObjectStream(
          generateStructuredJsonText({
            modelId,
            system: '你是小红书内容策略师。请用紧凑、直接的中文输出策略 JSON。',
            prompt: buildCompactStrategyFallbackPrompt(input),
            schema: strategySchema,
            validate: isStrategyResult,
            label: '策略生成',
            temperature: 0.2,
            maxOutputTokens: 220,
            abortSignal,
          }).then((object) => object as unknown as Record<string, unknown>),
        );
      }

      return streamObject({
        model: llmAnalysis(modelId),
        schema: jsonSchema<StrategyResult>(strategySchema),
        system,
        prompt,
        temperature: 0.3,
        maxRetries: 3,
        abortSignal,
      });
    },
  };
}

function rankSamplesByAvailability(
  samples: SimilarSample[],
  isEligible: (sample: SimilarSample) => boolean,
): SimilarSample[] {
  return samples.filter(isEligible).sort((left, right) => right.similarity - left.similarity);
}

function createReferenceReason(referenceType: ReferenceType): string {
  switch (referenceType) {
    case 'title':
      return '标题模式说明完整，适合提供标题节奏参考';
    case 'structure':
      return '结构拆解信息完整，适合提供段落与开头组织参考';
    case 'visual':
      return '封面表达摘要完整，适合提供封面表达参考';
    case 'tone':
      return '综合语气摘要明确，适合提供语气参考';
  }
}

export async function understandTask(
  input: TaskInput,
  dependencies: StrategyDependencies = createDefaultStrategyDependencies(),
  abortSignal?: AbortSignal,
): Promise<TaskUnderstandingResult> {
  return dependencies.generateTaskUnderstanding({
    system: TASK_UNDERSTANDING_SYSTEM_PROMPT,
    prompt: buildTaskUnderstandingPrompt(input),
    abortSignal,
  });
}

export function resolveReferenceMode(
  similarSamples: SimilarSample[],
  zeroShotThreshold = 0.6,
): ReferenceMode {
  if (similarSamples.length === 0) {
    return 'zero-shot';
  }

  return similarSamples[0].similarity < zeroShotThreshold ? 'zero-shot' : 'referenced';
}

function buildLexicalSearchStages(filters: {
  track?: string;
  content_type?: string[];
  title_pattern_hints?: string[];
  is_reference_allowed?: boolean;
}): Array<{
  track?: string;
  content_type?: string[];
  title_pattern_hints?: string[];
  is_reference_allowed?: boolean;
}> {
  return [
    filters,
    {
      ...filters,
      title_pattern_hints: undefined,
    },
    {
      ...filters,
      title_pattern_hints: undefined,
      content_type: undefined,
    },
    {
      ...filters,
      title_pattern_hints: undefined,
      content_type: undefined,
      track: undefined,
    },
    {
      is_reference_allowed: filters.is_reference_allowed,
    },
  ];
}

async function searchLexicalCandidatesWithFallbacks(
  params: {
    query: string;
    topic?: string;
    filters: {
      track?: string;
      content_type?: string[];
      title_pattern_hints?: string[];
      is_reference_allowed?: boolean;
    };
    limit?: number;
  },
  dependencies: StrategyDependencies,
): Promise<SimilarSample[]> {
  const fallbackStages = buildLexicalSearchStages(params.filters);
  const minimumCandidateCount = Math.min(params.limit ?? 20, 5);
  let bestCandidates: SimilarSample[] = [];

  for (const stageFilters of fallbackStages) {
    const candidates = await dependencies.searchLexicalSamples({
      query: params.query,
      topic: params.topic,
      filters: stageFilters,
      limit: params.limit,
    });

    if (candidates.length > bestCandidates.length) {
      bestCandidates = candidates;
    }

    if (candidates.length >= minimumCandidateCount) {
      return candidates;
    }
  }

  return bestCandidates;
}

export function selectTaskReferences(
  similarSamples: SimilarSample[],
  _taskUnderstanding: TaskUnderstandingResult,
  referenceMode: ReferenceMode,
): TaskReferencesSelection {
  if (referenceMode === 'zero-shot') {
    return {
      reference_mode: referenceMode,
      candidate_count: similarSamples.length,
      selected_references: [],
    };
  }

  const selectedReferences: SelectedTaskReference[] = [];
  const pushMatches = (
    referenceType: ReferenceType,
    matches: SimilarSample[],
    limit: number,
  ) => {
    for (const sample of matches.slice(0, limit)) {
      selectedReferences.push({
        sample_id: sample.sample_id,
        title: sample.title,
        similarity: sample.similarity,
        reference_type: referenceType,
        reason: createReferenceReason(referenceType),
      });
    }
  };

  pushMatches(
    'title',
    rankSamplesByAvailability(similarSamples, (sample) => Boolean(sample.title_pattern_explanation)),
    2,
  );
  pushMatches(
    'structure',
    rankSamplesByAvailability(
      similarSamples,
      (sample) => Boolean(sample.structure_explanation || sample.opening_explanation),
    ),
    3,
  );
  pushMatches(
    'visual',
    rankSamplesByAvailability(similarSamples, (sample) => Boolean(sample.cover_explanation)),
    1,
  );
  pushMatches(
    'tone',
    rankSamplesByAvailability(similarSamples, (sample) => Boolean(sample.reasoning_summary)),
    1,
  );

  return {
    reference_mode: referenceMode,
    candidate_count: similarSamples.length,
    selected_references: selectedReferences,
  };
}

export function buildReferenceContextBlocks(
  selectedReferences: SelectedTaskReference[],
  similarSamples: SimilarSample[],
): ReferenceContextBlock[] {
  const sampleMap = new Map(similarSamples.map((sample) => [sample.sample_id, sample]));

  return selectedReferences.flatMap((reference) => {
    const sample = sampleMap.get(reference.sample_id);
    if (!sample) {
      return [];
    }

    const promptBlock = (() => {
      switch (reference.reference_type) {
        case 'title':
          return [
            `原标题：${sample.title}`,
            `标题模式解读：${sample.title_pattern_explanation ?? '未提供'}`,
          ].join('\n');
        case 'structure':
          return [
            `原标题：${sample.title}`,
            `结构解读：${sample.structure_explanation ?? '未提供'}`,
            `开头解读：${sample.opening_explanation ?? '未提供'}`,
          ].join('\n');
        case 'visual':
          return [
            `原标题：${sample.title}`,
            `封面表达解读：${sample.cover_explanation ?? '未提供'}`,
          ].join('\n');
        case 'tone':
          return [
            `原标题：${sample.title}`,
            `语气摘要：${sample.reasoning_summary ?? '未提供'}`,
          ].join('\n');
      }
    })();

    return [{ ...reference, promptBlock }];
  });
}

export function buildStrategyPrompt(input: {
  taskInput: TaskInput;
  taskUnderstanding: TaskUnderstandingResult;
  referenceSelection: TaskReferencesSelection;
  referenceBlocks: ReferenceContextBlock[];
}): string {
  const referenceSection =
    input.referenceSelection.reference_mode === 'zero-shot'
      ? '参考模式：zero-shot\n没有命中足够可信的样本，请基于通用高互动内容逻辑输出策略。'
      : [
          '参考模式：referenced',
          '以下是按用途裁剪后的样本摘要，每条策略都要明确引用对应样本维度。',
          ...input.referenceBlocks.map(
            (block, index) =>
              `### 参考 ${index + 1}\n样本ID：${block.sample_id}\n用途：${block.reference_type}\n原因：${block.reason}\n${block.promptBlock}`,
          ),
        ].join('\n\n');

  return [
    '请根据任务与参考摘要，输出本次创作的结构化策略。',
    `主题：${input.taskInput.topic}`,
    `目标人群：${input.taskInput.targetAudience ?? '未提供'}`,
    `目标效果：${input.taskInput.goal ?? '未提供'}`,
    `风格倾向：${input.taskInput.stylePreference ?? '未提供'}`,
    `persona_mode：${input.taskInput.personaMode ?? 'balanced'}`,
    `指定画像：${input.taskInput.styleProfileId ?? '未提供'}`,
    `是否需要封面建议：${input.taskInput.needCoverSuggestion ?? true ? '是' : '否'}`,
    '',
    '任务理解：',
    ...buildTaskSummaryLines(input.taskUnderstanding),
    '',
    referenceSection,
  ].join('\n');
}

export async function streamStrategy(
  input: {
    taskInput: TaskInput;
    taskUnderstanding: TaskUnderstandingResult;
    referenceSelection: TaskReferencesSelection;
    referenceBlocks: ReferenceContextBlock[];
  },
  dependencies: StreamStrategyDependencies = createDefaultStreamStrategyDependencies(),
): Promise<{
  snapshots: Partial<StrategyResult>[];
  strategy: StrategyResult;
}> {
  const result = startStrategyStream(input, dependencies);

  const snapshots: Partial<StrategyResult>[] = [];
  for await (const partial of result.partialObjectStream) {
    if (partial && Object.keys(partial).length > 0) {
      snapshots.push(partial as Partial<StrategyResult>);
    }
  }

  const strategy = await result.object as unknown as StrategyResult;
  snapshots.push(strategy);

  return { snapshots, strategy };
}

export function startStrategyStream(
  input: {
    taskInput: TaskInput;
    taskUnderstanding: TaskUnderstandingResult;
    referenceSelection: TaskReferencesSelection;
    referenceBlocks: ReferenceContextBlock[];
  },
  dependencies: StreamStrategyDependencies = createDefaultStreamStrategyDependencies(),
  abortSignal?: AbortSignal,
) {
  return dependencies.streamStrategyObject({
    system: STRATEGY_SYSTEM_PROMPT,
    prompt: buildStrategyPrompt(input),
    input,
    abortSignal,
  });
}

export async function retrieveTaskReferencesFromUnderstanding(
  taskUnderstanding: TaskUnderstandingResult,
  dependencies: StrategyDependencies = createDefaultStrategyDependencies(),
  options: RetrieveTaskReferencesOptions = {},
  abortSignal?: AbortSignal,
): Promise<RetrieveTaskReferencesResult> {
  const searchModeStatus = dependencies.getSearchModeStatus();
  const systemFilters = {
    ...taskUnderstanding.search_filters,
    is_reference_allowed: true,
  };

  if (searchModeStatus.searchMode === 'misconfigured') {
    throw new Error(searchModeStatus.searchModeReason ?? 'Embedding provider is misconfigured.');
  }

  if (searchModeStatus.searchMode === 'lexical-only') {
    const similarSamples = await searchLexicalCandidatesWithFallbacks(
      {
        query: taskUnderstanding.rewritten_query,
        topic: options.topic,
        filters: systemFilters,
        limit: options.limit,
      },
      dependencies,
    );

    return {
      searchMode: searchModeStatus.searchMode,
      searchModeReason: searchModeStatus.searchModeReason,
      referenceMode: resolveReferenceMode(
        similarSamples,
        options.zeroShotThreshold ?? 0.35,
      ),
      similarSamples,
      taskUnderstanding,
      taskEmbedding: [],
    };
  }

  const taskEmbedding = await dependencies.createTaskEmbedding(
    taskUnderstanding.rewritten_query,
    abortSignal,
  );
  const similarSamples = await dependencies.searchSimilarSamples({
    taskEmbedding,
    filters: systemFilters,
    limit: options.limit,
    similarityThreshold: 0,
  });

  return {
    searchMode: searchModeStatus.searchMode,
    searchModeReason: searchModeStatus.searchModeReason,
    referenceMode: resolveReferenceMode(
      similarSamples,
      options.zeroShotThreshold ?? 0.6,
    ),
    similarSamples,
    taskUnderstanding,
    taskEmbedding,
  };
}

export async function retrieveTaskReferences(
  input: TaskInput,
  dependencies: StrategyDependencies = createDefaultStrategyDependencies(),
  options: RetrieveTaskReferencesOptions = {},
): Promise<RetrieveTaskReferencesResult> {
  const taskUnderstanding = await understandTask(input, dependencies);
  return retrieveTaskReferencesFromUnderstanding(taskUnderstanding, dependencies, {
    ...options,
    topic: input.topic,
  });
}
