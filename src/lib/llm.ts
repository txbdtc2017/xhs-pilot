import { createOpenAI } from '@ai-sdk/openai';

const apiKey = process.env.LLM_API_KEY;
const baseURL = process.env.LLM_BASE_URL;

const openai = createOpenAI({
  apiKey,
  baseURL,
});

const embeddingOpenAI = createOpenAI({
  apiKey: process.env.EMBEDDING_API_KEY || apiKey,
  baseURL: process.env.EMBEDDING_BASE_URL || baseURL,
});

// These are the clients (factories)
export const llmAnalysis = openai;
export const llmGeneration = openai;
export const llmVision = openai;
export const llmEmbedding = embeddingOpenAI;

// Note: Usage will be llmAnalysis(process.env.LLM_MODEL_ANALYSIS!)
