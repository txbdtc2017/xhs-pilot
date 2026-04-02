import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import {
  normalizeAnthropicBaseUrl,
  resolveAnthropicCompatibleModelId,
  resolveAnthropicProviderHeaders,
} from './anthropic-provider-compat';
import { resolveEnvValue } from './env';

export const SUPPORTED_PROVIDER_PROTOCOLS = ['openai', 'anthropic-messages'] as const;
export type ProviderProtocol = (typeof SUPPORTED_PROVIDER_PROTOCOLS)[number];
export const SUPPORTED_IMAGE_PROVIDER_PROTOCOLS = ['openai'] as const;
export type ImageProviderProtocol = (typeof SUPPORTED_IMAGE_PROVIDER_PROTOCOLS)[number];

export interface ProviderOptions {
  protocol: ProviderProtocol;
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
}

export interface EmbeddingProviderOptions {
  apiKey?: string;
  baseURL?: string;
}

export interface ImageProviderOptions {
  protocol: ImageProviderProtocol;
  apiKey?: string;
  baseURL?: string;
}

export interface ResolvedProviderOptions {
  llm: ProviderOptions;
  vision: ProviderOptions;
  embedding: EmbeddingProviderOptions;
  image: ImageProviderOptions;
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

function resolveImageProviderProtocol(
  value: string | undefined,
): ImageProviderProtocol {
  const resolved = resolveEnvValue(value, 'openai') ?? 'openai';

  if (SUPPORTED_IMAGE_PROVIDER_PROTOCOLS.includes(resolved as ImageProviderProtocol)) {
    return resolved as ImageProviderProtocol;
  }

  throw new Error('IMAGE_PROTOCOL must be "openai"');
}

function applyAnthropicProviderCompatibility(options: ProviderOptions): ProviderOptions {
  if (options.protocol !== 'anthropic-messages') {
    return options;
  }

  const headers = {
    ...resolveAnthropicProviderHeaders(options.baseURL),
    ...options.headers,
  };

  return {
    ...options,
    baseURL: normalizeAnthropicBaseUrl(options.baseURL),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };
}

function createLanguageModelFactory(options: ProviderOptions, providerName: string) {
  const compatibleOptions = applyAnthropicProviderCompatibility(options);

  if (compatibleOptions.protocol === 'anthropic-messages') {
    const provider = createAnthropic({
      apiKey: compatibleOptions.apiKey,
      baseURL: compatibleOptions.baseURL,
      headers: compatibleOptions.headers,
    });

    return (modelId: string) => {
      assertApiKey(compatibleOptions.apiKey, providerName);
      return provider(resolveAnthropicCompatibleModelId(modelId, compatibleOptions.baseURL));
    };
  }

  const provider = createOpenAI({
    apiKey: compatibleOptions.apiKey,
    baseURL: compatibleOptions.baseURL,
  });

  return (modelId: string) => {
    assertApiKey(compatibleOptions.apiKey, providerName);
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

function createImageModelFactory(options: ImageProviderOptions) {
  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  });

  return {
    imageModel(modelId: string) {
      assertApiKey(options.apiKey, 'Image provider');
      return provider.imageModel(modelId as Parameters<typeof provider.imageModel>[0]);
    },
  };
}

export function resolveProviderOptions(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProviderOptions {
  const llmProtocol = resolveProviderProtocol(env.LLM_PROTOCOL, 'openai', 'LLM_PROTOCOL');

  const llm = applyAnthropicProviderCompatibility({
    protocol: llmProtocol,
    apiKey: resolveEnvValue(env.LLM_API_KEY),
    baseURL: resolveEnvValue(env.LLM_BASE_URL),
  });

  return {
    llm,
    vision: applyAnthropicProviderCompatibility({
      protocol: resolveProviderProtocol(env.VISION_PROTOCOL, llmProtocol, 'VISION_PROTOCOL'),
      apiKey: resolveEnvValue(env.VISION_API_KEY, llm.apiKey),
      baseURL: resolveEnvValue(env.VISION_BASE_URL, llm.baseURL),
    }),
    embedding: {
      apiKey: resolveEnvValue(env.EMBEDDING_API_KEY),
      baseURL: resolveEnvValue(env.EMBEDDING_BASE_URL),
    },
    image: {
      protocol: resolveImageProviderProtocol(env.IMAGE_PROTOCOL),
      apiKey: resolveEnvValue(env.IMAGE_API_KEY),
      baseURL: resolveEnvValue(env.IMAGE_BASE_URL),
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
    llmImage: createImageModelFactory(providers.image),
  };
}

const providerFactories = createProviderFactories();

export const llmAnalysis = providerFactories.llmAnalysis;
export const llmGeneration = providerFactories.llmGeneration;
export const llmVision = providerFactories.llmVision;
export const llmEmbedding = providerFactories.llmEmbedding;
export const llmImage = providerFactories.llmImage;

// Note: Usage will be llmAnalysis(process.env.LLM_MODEL_ANALYSIS!)
