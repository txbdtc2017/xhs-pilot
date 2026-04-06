import type { JSONSchema7 } from 'json-schema';

export type ImagePlanPageRole = 'cover' | 'body';
export type ImagePlanVisualType = 'info-card' | 'scene';

export interface ImagePlanPageResult {
  sort_order: number;
  page_role: ImagePlanPageRole;
  content_purpose: string;
  source_excerpt: string;
  visual_type: ImagePlanVisualType;
  style_reason: string;
  prompt_summary: string;
  prompt_text: string;
}

export interface ImagePlanResult {
  system_decision_summary: string;
  pages: ImagePlanPageResult[];
}

export function isImagePlanResult(value: unknown): value is ImagePlanResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.system_decision_summary !== 'string' || !Array.isArray(record.pages)) {
    return false;
  }

  return record.pages.every((page) => {
    if (!page || typeof page !== 'object') {
      return false;
    }

    const pageRecord = page as Record<string, unknown>;
    return Number.isInteger(pageRecord.sort_order)
      && (pageRecord.page_role === 'cover' || pageRecord.page_role === 'body')
      && typeof pageRecord.content_purpose === 'string'
      && typeof pageRecord.source_excerpt === 'string'
      && (pageRecord.visual_type === 'info-card' || pageRecord.visual_type === 'scene')
      && typeof pageRecord.style_reason === 'string'
      && typeof pageRecord.prompt_summary === 'string'
      && typeof pageRecord.prompt_text === 'string';
  });
}

export const imagePlanSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    system_decision_summary: {
      type: 'string',
      description: '整套图片计划决策摘要',
    },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sort_order: { type: 'integer' },
          page_role: {
            type: 'string',
            enum: ['cover', 'body'],
          },
          content_purpose: { type: 'string' },
          source_excerpt: { type: 'string' },
          visual_type: {
            type: 'string',
            enum: ['info-card', 'scene'],
          },
          style_reason: { type: 'string' },
          prompt_summary: { type: 'string' },
          prompt_text: { type: 'string' },
        },
        required: [
          'sort_order',
          'page_role',
          'content_purpose',
          'source_excerpt',
          'visual_type',
          'style_reason',
          'prompt_summary',
          'prompt_text',
        ],
        additionalProperties: false,
      },
      minItems: 1,
    },
  },
  required: ['system_decision_summary', 'pages'],
  additionalProperties: false,
};
