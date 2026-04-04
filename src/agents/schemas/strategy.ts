import type { JSONSchema7 } from 'json-schema';

export type StrategyContentDirection = '干货' | '情绪' | '故事' | '观点' | '教程' | '测评';
const STRATEGY_CONTENT_DIRECTIONS: StrategyContentDirection[] = ['干货', '情绪', '故事', '观点', '教程', '测评'];

export interface StrategyResult {
  content_direction: StrategyContentDirection;
  title_strategy: string;
  opening_strategy?: string;
  structure_strategy: string;
  cover_strategy?: string;
  cta_strategy?: string;
  warnings?: string[];
  strategy_summary: string;
}

export const strategySchema: JSONSchema7 = {
  type: 'object',
  properties: {
    content_direction: {
      type: 'string',
      enum: ['干货', '情绪', '故事', '观点', '教程', '测评'],
      description: '内容方向',
    },
    title_strategy: {
      type: 'string',
      description: '标题策略，含参考依据',
    },
    opening_strategy: {
      type: 'string',
      description: '开头策略',
    },
    structure_strategy: {
      type: 'string',
      description: '结构策略',
    },
    cover_strategy: {
      type: 'string',
      description: '封面策略',
    },
    cta_strategy: {
      type: 'string',
      description: 'CTA 策略',
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: '避免事项',
    },
    strategy_summary: {
      type: 'string',
      description: '策略总结',
    },
  },
  required: ['content_direction', 'title_strategy', 'structure_strategy', 'strategy_summary'],
  additionalProperties: false,
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isStrategyResult(value: unknown): value is StrategyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.content_direction !== 'string'
    || !STRATEGY_CONTENT_DIRECTIONS.includes(record.content_direction as StrategyContentDirection)
  ) {
    return false;
  }

  if (typeof record.title_strategy !== 'string' || typeof record.structure_strategy !== 'string' || typeof record.strategy_summary !== 'string') {
    return false;
  }

  if (record.opening_strategy !== undefined && typeof record.opening_strategy !== 'string') {
    return false;
  }

  if (record.cover_strategy !== undefined && typeof record.cover_strategy !== 'string') {
    return false;
  }

  if (record.cta_strategy !== undefined && typeof record.cta_strategy !== 'string') {
    return false;
  }

  if (record.warnings !== undefined && !isStringArray(record.warnings)) {
    return false;
  }

  return true;
}
