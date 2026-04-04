import { generateText, parsePartialJson } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { isKimiCodingAnthropicBaseUrl } from '@/lib/anthropic-provider-compat';
import { llmAnalysis } from '@/lib/llm';

const STRUCTURED_OUTPUT_TIMEOUT_MS = 30_000;

type Validator<T> = (value: unknown) => value is T;

export function shouldUseTextStructuredOutputFallback(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.LLM_PROTOCOL === 'anthropic-messages'
    && isKimiCodingAnthropicBaseUrl(env.LLM_BASE_URL);
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Structured output was empty.');
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

export async function parseStructuredJsonText<T>(
  text: string,
  validate: Validator<T>,
  label: string,
): Promise<T> {
  const jsonText = extractJsonBlock(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const repaired = await parsePartialJson(jsonText);
    if (repaired.state === 'successful-parse' || repaired.state === 'repaired-parse') {
      parsed = repaired.value;
    } else {
      throw new Error(
        `${label} JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!validate(parsed)) {
    throw new Error(`${label} JSON 结构无效。`);
  }

  return parsed;
}

export async function generateStructuredJsonText<T>(params: {
  modelId: string;
  system: string;
  prompt: string;
  schema: JSONSchema7;
  validate: Validator<T>;
  label: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STRUCTURED_OUTPUT_TIMEOUT_MS);

  try {
    const { text } = await generateText({
      model: llmAnalysis(params.modelId),
      system: [
        params.system,
        '你必须只输出一个合法 JSON 对象。',
        '不要输出 Markdown、代码块、解释说明或额外文本。',
      ].join('\n\n'),
      prompt: [
        params.prompt,
        '',
        '请严格遵循下面的 JSON Schema 输出：',
        JSON.stringify(params.schema, null, 2),
      ].join('\n'),
      temperature: params.temperature ?? 0,
      maxOutputTokens: params.maxOutputTokens,
      maxRetries: 3,
      abortSignal: controller.signal,
    });

    return await parseStructuredJsonText(text, params.validate, params.label);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${params.label} 超时，超过 30 秒仍未返回。`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createSingleObjectStream<T extends Record<string, unknown>>(object: Promise<T>): {
  partialObjectStream: AsyncIterable<T>;
  object: Promise<T>;
} {
  return {
    partialObjectStream: {
      async *[Symbol.asyncIterator]() {
        yield await object;
      },
    },
    object,
  };
}
