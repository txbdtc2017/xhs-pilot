import type { JSONSchema7 } from 'json-schema';

export type TaskType = '干货' | '情绪' | '故事' | '观点' | '教程' | '测评';
export type ReferenceFocus = '标题' | '结构' | '视觉' | '语气';
export type TaskGoal = '收藏' | '评论' | '涨粉' | '转化' | '综合';

export interface TaskUnderstandingSearchFilters {
  track: string;
  content_type?: string[];
  title_pattern_hints?: string[];
}

export interface TaskUnderstandingResult {
  task_type: TaskType;
  suitable_structure?: string;
  reference_focus?: ReferenceFocus[];
  notes?: string;
  search_filters: TaskUnderstandingSearchFilters;
  rewritten_query: string;
  goal?: TaskGoal;
}

export const taskUnderstandingSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    task_type: {
      type: 'string',
      enum: ['干货', '情绪', '故事', '观点', '教程', '测评'],
      description: '任务类型',
    },
    suitable_structure: {
      type: 'string',
      description: '建议的内容结构',
    },
    reference_focus: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['标题', '结构', '视觉', '语气'],
      },
      description: '应侧重参考的维度',
    },
    notes: {
      type: 'string',
      description: '策略注意事项',
    },
    search_filters: {
      type: 'object',
      properties: {
        track: {
          type: 'string',
          description: '赛道',
        },
        content_type: {
          type: 'array',
          items: { type: 'string' },
          description: '内容类型候选',
        },
        title_pattern_hints: {
          type: 'array',
          items: { type: 'string' },
          description: '标题模式提示',
        },
      },
      required: ['track'],
      additionalProperties: false,
    },
    rewritten_query: {
      type: 'string',
      description: '重写后的检索文本，用于 embedding 相似度计算',
    },
    goal: {
      type: 'string',
      enum: ['收藏', '评论', '涨粉', '转化', '综合'],
      description: '目标效果',
    },
  },
  required: ['task_type', 'search_filters', 'rewritten_query'],
  additionalProperties: false,
};
