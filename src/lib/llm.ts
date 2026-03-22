import { createOpenAI } from '@ai-sdk/openai';
import { resolveEnvValue } from './env';

export interface ProviderOptions {
  apiKey?: string;
  baseURL?: string;
}

export interface ResolvedProviderOptions {
  llm: ProviderOptions;
  vision: ProviderOptions;
  embedding: ProviderOptions;
}

export function resolveProviderOptions(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProviderOptions {
  const llm: ProviderOptions = {
    apiKey: resolveEnvValue(env.LLM_API_KEY),
    baseURL: resolveEnvValue(env.LLM_BASE_URL),
  };

  return {
    llm,
    vision: {
      apiKey: resolveEnvValue(env.VISION_API_KEY, llm.apiKey),
      baseURL: resolveEnvValue(env.VISION_BASE_URL, llm.baseURL),
    },
    embedding: {
      apiKey: resolveEnvValue(env.EMBEDDING_API_KEY, llm.apiKey),
      baseURL: resolveEnvValue(env.EMBEDDING_BASE_URL, llm.baseURL),
    },
  };
}

const providers = resolveProviderOptions();

const openai = createOpenAI(providers.llm);
const visionOpenAI = createOpenAI(providers.vision);
const embeddingOpenAI = createOpenAI(providers.embedding);

// These are the clients (factories)
export const llmAnalysis = openai;
export const llmGeneration = openai;
export const llmVision = visionOpenAI;
export const llmEmbedding = embeddingOpenAI;

// Note: Usage will be llmAnalysis(process.env.LLM_MODEL_ANALYSIS!)
