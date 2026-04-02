import { GoogleGenAI, Modality } from '@google/genai';
import { generateImage } from 'ai';
import type { ImageProviderId } from '@/app/api/image-generation/capability';
import { resolveGoogleVertexImageConfig } from '@/app/api/image-generation/capability';
import { llmImage } from '@/lib/llm';

export interface GeneratedImageArtifact {
  data: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface ImageGenerationDependencies {
  generateOpenAiBatch: (params: {
    prompt: string;
    candidateCount: number;
    modelName: string;
  }) => Promise<GeneratedImageArtifact[]>;
  generateGoogleSingle: (params: {
    prompt: string;
    modelName: string;
  }) => Promise<GeneratedImageArtifact>;
}

function resolveMimeType(chunk: Record<string, unknown>): string {
  const parts = Array.isArray(chunk.candidates)
    ? chunk.candidates.flatMap((candidate) => {
      const content = (candidate as { content?: { parts?: unknown[] } }).content;
      return Array.isArray(content?.parts) ? content.parts : [];
    })
    : [];

  for (const part of parts) {
    const inlineData = (part as { inlineData?: { mimeType?: unknown }; inline_data?: { mimeType?: unknown } }).inlineData
      ?? (part as { inlineData?: { mimeType?: unknown }; inline_data?: { mimeType?: unknown } }).inline_data;
    const mimeType = inlineData?.mimeType;
    if (typeof mimeType === 'string' && mimeType.trim()) {
      return mimeType.trim();
    }
  }

  return 'image/png';
}

export function extractGoogleImageData(chunk: unknown): Buffer | undefined {
  if (!chunk || typeof chunk !== 'object') {
    return undefined;
  }

  const parts = Array.isArray((chunk as { candidates?: unknown[] }).candidates)
    ? (chunk as { candidates: Array<{ content?: { parts?: unknown[] } }> }).candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
    : [];

  for (const part of parts) {
    const inlineData = (part as { inlineData?: { data?: unknown }; inline_data?: { data?: unknown } }).inlineData
      ?? (part as { inlineData?: { data?: unknown }; inline_data?: { data?: unknown } }).inline_data;
    const data = inlineData?.data;

    if (!data) {
      continue;
    }

    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (data instanceof Uint8Array) {
      return Buffer.from(data);
    }

    if (typeof data === 'string') {
      return Buffer.from(data, 'base64');
    }
  }

  return undefined;
}

function extractGoogleChunkText(chunk: unknown): string {
  if (!chunk || typeof chunk !== 'object') {
    return '';
  }

  const parts = Array.isArray((chunk as { candidates?: unknown[] }).candidates)
    ? (chunk as { candidates: Array<{ content?: { parts?: unknown[] } }> }).candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
    : [];

  return parts
    .filter((part): part is { text: string } => typeof (part as { text?: unknown }).text === 'string')
    .map((part) => part.text)
    .join('');
}

export async function collectGoogleImageStreamResult(stream: unknown): Promise<{
  imageBytes: Buffer;
  mimeType: string;
  text: string;
}> {
  const iterable = typeof (stream as { [Symbol.asyncIterator]?: unknown })?.[Symbol.asyncIterator] === 'function'
    ? stream as AsyncIterable<unknown>
    : (stream as { stream?: AsyncIterable<unknown> })?.stream;

  if (!iterable || typeof iterable[Symbol.asyncIterator] !== 'function') {
    throw new Error('Google image stream is not iterable.');
  }

  let imageBytes: Buffer | undefined;
  let mimeType = 'image/png';
  let text = '';

  for await (const chunk of iterable) {
    text += extractGoogleChunkText(chunk);

    if (!imageBytes) {
      imageBytes = extractGoogleImageData(chunk);
      mimeType = resolveMimeType(chunk as Record<string, unknown>);
    }
  }

  if (!imageBytes) {
    throw new Error('No image bytes were returned by Google Banana.');
  }

  return { imageBytes, mimeType, text };
}

function classifyGoogleImageError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const lowered = message.toLowerCase();

  if (lowered.includes('permission') || lowered.includes('permission denied')) {
    return `Google Banana 权限不足：${message}`;
  }

  if (lowered.includes('credential') || lowered.includes('unauthenticated')) {
    return `Google Banana 凭证无效：${message}`;
  }

  if (lowered.includes('billing') || lowered.includes('service disabled')) {
    return `Google Banana 当前不可用：${message}`;
  }

  return `Google Banana 生成失败：${message}`;
}

function createDefaultImageGenerationDependencies(): ImageGenerationDependencies {
  return {
    generateOpenAiBatch: async ({ prompt, candidateCount, modelName }) => {
      const result = await generateImage({
        model: llmImage.imageModel(modelName),
        prompt,
        size: '1024x1536',
        n: candidateCount,
        maxRetries: 2,
        providerOptions: {
          openai: {
            quality: 'medium',
            outputFormat: 'png',
          },
        },
      });

      const images = Array.isArray(result.images) && result.images.length > 0
        ? result.images
        : result.image
          ? [result.image]
          : [];

      return images.map((image) => ({
        data: Buffer.from(image.uint8Array),
        mimeType: 'image/png',
        width: null,
        height: null,
      }));
    },
    generateGoogleSingle: async ({ prompt, modelName }) => {
      const config = resolveGoogleVertexImageConfig(process.env);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = config.credentialsPath;

      const client = new GoogleGenAI({
        vertexai: true,
        project: config.projectId,
        location: config.location,
      });

      try {
        const stream = await client.models.generateContentStream({
          model: modelName,
          contents: prompt,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        const result = await collectGoogleImageStreamResult(stream);
        return {
          data: result.imageBytes,
          mimeType: result.mimeType,
          width: null,
          height: null,
        };
      } catch (error) {
        throw new Error(classifyGoogleImageError(error), { cause: error instanceof Error ? error : undefined });
      }
    },
  };
}

export async function generatePlannedImages(
  {
    provider,
    promptText,
    candidateCount,
    modelName,
  }: {
    provider: ImageProviderId;
    promptText: string;
    candidateCount: number;
    modelName: string;
  },
  dependencies: ImageGenerationDependencies = createDefaultImageGenerationDependencies(),
): Promise<GeneratedImageArtifact[]> {
  if (provider === 'google_vertex') {
    const images: GeneratedImageArtifact[] = [];

    for (let index = 0; index < candidateCount; index += 1) {
      images.push(await dependencies.generateGoogleSingle({
        prompt: promptText,
        modelName,
      }));
    }

    return images;
  }

  return dependencies.generateOpenAiBatch({
    prompt: promptText,
    candidateCount,
    modelName,
  });
}
