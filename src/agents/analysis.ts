import { generateObject, jsonSchema } from 'ai';
import { llmAnalysis, llmVision } from '@/lib/llm';
import { analysisSchema, AnalysisResult } from './schemas/analysis';
import { visualAnalysisSchema, VisualAnalysisResult } from './schemas/visual-analysis';
import { ANALYSIS_SYSTEM_PROMPT, VISUAL_ANALYSIS_SYSTEM_PROMPT } from './prompts/analysis';

export async function analyzeText(title: string, body: string): Promise<AnalysisResult> {
  const { object } = await generateObject({
    model: llmAnalysis(process.env.LLM_MODEL_ANALYSIS || 'gpt-4o'),
    schema: jsonSchema<AnalysisResult>(analysisSchema),
    system: ANALYSIS_SYSTEM_PROMPT,
    prompt: `标题：${title}\n\n正文：\n${body}`,
    temperature: 0,
    maxRetries: 3,
  });
  return object;
}

export async function analyzeImage(imageBuffer: Buffer): Promise<VisualAnalysisResult> {
  const { object } = await generateObject({
    model: llmVision(process.env.LLM_MODEL_VISION || 'gpt-4o'),
    schema: jsonSchema<VisualAnalysisResult>(visualAnalysisSchema),
    system: VISUAL_ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '请分析这张图片：' },
          { type: 'image', image: imageBuffer }
        ]
      }
    ],
    temperature: 0,
    maxRetries: 3,
  });
  return object;
}
