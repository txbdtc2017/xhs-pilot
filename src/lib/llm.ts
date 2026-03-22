import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { resolveEnvValue } from './env';

export const SUPPORTED_PROVIDER_PROTOCOLS = ['openai', 'anthropic-messages'] as const;
export type ProviderProtocol = (typeof SUPPORTED_PROVIDER_PROTOCOLS)[number];

export interface ProviderOptions {
  protocol: ProviderProtocol;
  apiKey?: string;
  baseURL?: string;
}

export interface EmbeddingProviderOptions {
  apiKey?: string;
  baseURL?: string;
}

export interface ResolvedProviderOptions {
  llm: ProviderOptions;
  vision: ProviderOptions;
  embedding: EmbeddingProviderOptions;
}

function resolveProviderProtocol(
  value: string | undefined,
  fallback: ProviderProtocol,
  envKey: 'LLM_PROTOCOL' | 'VISION_PROTOCOL',
): ProviderProtocol {
  const resolved = resolveEnvValue(value, fallback) ?? fallback;

  if (SUPPORTED_PROVIDER_PROTOCOLS.includes(resolved as ProviderProtocol)) {
    return resolved as ProviderProtocol;
  }

  throw new Error(`${envKey} must be "openai" or "anthropic-messages"`);
}

function assertApiKey(apiKey: string | undefined, providerName: string): void {
  if (!apiKey) {
    throw new Error(`${providerName} API key is required`);
  }
}

function createLanguageModelFactory(options: ProviderOptions, providerName: string) {
  if (options.protocol === 'anthropic-messages') {
    const provider = createAnthropic({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });

    return (modelId: string) => {
      assertApiKey(options.apiKey, providerName);
      return provider(modelId);
    };
  }

  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  });

  return (modelId: string) => {
    assertApiKey(options.apiKey, providerName);
    return provider(modelId);
  };
}

function createEmbeddingModelFactory(options: EmbeddingProviderOptions) {
  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  });

  return {
    textEmbeddingModel(modelId: string) {
      assertApiKey(options.apiKey, 'Embedding provider');
      return provider.textEmbeddingModel(modelId);
    },
  };
}

export function resolveProviderOptions(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProviderOptions {
  const llmProtocol = resolveProviderProtocol(env.LLM_PROTOCOL, 'openai', 'LLM_PROTOCOL');

  const llm: ProviderOptions = {
    protocol: llmProtocol,
    apiKey: resolveEnvValue(env.LLM_API_KEY),
    baseURL: resolveEnvValue(env.LLM_BASE_URL),
  };

  return {
    llm,
    vision: {
      protocol: resolveProviderProtocol(env.VISION_PROTOCOL, llmProtocol, 'VISION_PROTOCOL'),
      apiKey: resolveEnvValue(env.VISION_API_KEY, llm.apiKey),
      baseURL: resolveEnvValue(env.VISION_BASE_URL, llm.baseURL),
    },
    embedding: {
      apiKey: resolveEnvValue(env.EMBEDDING_API_KEY, llm.apiKey),
      baseURL: resolveEnvValue(env.EMBEDDING_BASE_URL, llm.baseURL),
    },
  };
}

export function createProviderFactories(env: NodeJS.ProcessEnv = process.env) {
  const providers = resolveProviderOptions(env);
  const sharedLlmFactory = createLanguageModelFactory(providers.llm, 'LLM provider');

  return {
    llmAnalysis: sharedLlmFactory,
    llmGeneration: sharedLlmFactory,
    llmVision: createLanguageModelFactory(providers.vision, 'Vision provider'),
    llmEmbedding: createEmbeddingModelFactory(providers.embedding),
  };
}

const providerFactories = createProviderFactories();

export const llmAnalysis = providerFactories.llmAnalysis;
export const llmGeneration = providerFactories.llmGeneration;
export const llmVision = providerFactories.llmVision;
export const llmEmbedding = providerFactories.llmEmbedding;

// Note: Usage will be llmAnalysis(process.env.LLM_MODEL_ANALYSIS!)
