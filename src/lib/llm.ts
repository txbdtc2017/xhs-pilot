import { createOpenAI } from '@ai-sdk/openai';
import { resolveEnvValue } from './env';

const apiKey = resolveEnvValue(process.env.LLM_API_KEY);
const baseURL = resolveEnvValue(process.env.LLM_BASE_URL);

const openai = createOpenAI({
  apiKey,
  baseURL,
});

const embeddingOpenAI = createOpenAI({
  apiKey: resolveEnvValue(process.env.EMBEDDING_API_KEY, apiKey),
  baseURL: resolveEnvValue(process.env.EMBEDDING_BASE_URL, baseURL),
});

// These are the clients (factories)
export const llmAnalysis = openai;
export const llmGeneration = openai;
export const llmVision = openai;
export const llmEmbedding = embeddingOpenAI;

// Note: Usage will be llmAnalysis(process.env.LLM_MODEL_ANALYSIS!)
