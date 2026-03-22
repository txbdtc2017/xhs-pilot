import type { JSONSchema7 } from 'json-schema';

export type StrategyContentDirection = '干货' | '情绪' | '故事' | '观点' | '教程' | '测评';

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
