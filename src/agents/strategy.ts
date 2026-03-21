import { embed, generateObject, jsonSchema } from 'ai';
import {
  searchSimilarSamples,
  type SearchSimilarSamplesParams,
  type SimilarSample,
} from '@/lib/db';
import { llmAnalysis, llmEmbedding } from '@/lib/llm';
import { TASK_UNDERSTANDING_SYSTEM_PROMPT } from './prompts/strategy';
import {
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

export interface RetrieveTaskReferencesResult {
  referenceMode: ReferenceMode;
  similarSamples: SimilarSample[];
  taskUnderstanding: TaskUnderstandingResult;
  taskEmbedding: number[];
}

export interface StrategyDependencies {
  generateTaskUnderstanding: (params: {
    system: string;
    prompt: string;
  }) => Promise<TaskUnderstandingResult>;
  createTaskEmbedding: (query: string) => Promise<number[]>;
  searchSimilarSamples: (params: SearchSimilarSamplesParams) => Promise<SimilarSample[]>;
}

export interface RetrieveTaskReferencesOptions {
  zeroShotThreshold?: number;
  limit?: number;
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

function createDefaultStrategyDependencies(): StrategyDependencies {
  return {
    generateTaskUnderstanding: async ({ system, prompt }) => {
      const { object } = await generateObject({
        model: llmAnalysis(process.env.LLM_MODEL_ANALYSIS || 'gpt-4o'),
        schema: jsonSchema<TaskUnderstandingResult>(taskUnderstandingSchema),
        system,
        prompt,
        temperature: 0,
        maxRetries: 3,
      });

      return object;
    },
    createTaskEmbedding: async (query) => {
      const { embedding } = await embed({
        model: llmEmbedding.textEmbeddingModel(
          process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        ),
        value: query,
        maxRetries: 3,
      });

      return embedding;
    },
    searchSimilarSamples,
  };
}

export async function understandTask(
  input: TaskInput,
  dependencies: StrategyDependencies = createDefaultStrategyDependencies(),
): Promise<TaskUnderstandingResult> {
  return dependencies.generateTaskUnderstanding({
    system: TASK_UNDERSTANDING_SYSTEM_PROMPT,
    prompt: buildTaskUnderstandingPrompt(input),
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

export async function retrieveTaskReferences(
  input: TaskInput,
  dependencies: StrategyDependencies = createDefaultStrategyDependencies(),
  options: RetrieveTaskReferencesOptions = {},
): Promise<RetrieveTaskReferencesResult> {
  const taskUnderstanding = await understandTask(input, dependencies);
  const taskEmbedding = await dependencies.createTaskEmbedding(taskUnderstanding.rewritten_query);
  const similarSamples = await dependencies.searchSimilarSamples({
    taskEmbedding,
    filters: {
      ...taskUnderstanding.search_filters,
      is_reference_allowed: true,
    },
    limit: options.limit,
    similarityThreshold: 0,
  });

  return {
    referenceMode: resolveReferenceMode(
      similarSamples,
      options.zeroShotThreshold ?? 0.6,
    ),
    similarSamples,
    taskUnderstanding,
    taskEmbedding,
  };
}
