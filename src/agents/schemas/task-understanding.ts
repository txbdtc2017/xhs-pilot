import type { JSONSchema7 } from 'json-schema';

export type TaskType = '干货' | '情绪' | '故事' | '观点' | '教程' | '测评';
export type ReferenceFocus = '标题' | '结构' | '视觉' | '语气';
export type TaskGoal = '收藏' | '评论' | '涨粉' | '转化' | '综合';

const TASK_TYPES: TaskType[] = ['干货', '情绪', '故事', '观点', '教程', '测评'];
const REFERENCE_FOCUS_VALUES: ReferenceFocus[] = ['标题', '结构', '视觉', '语气'];
const TASK_GOALS: TaskGoal[] = ['收藏', '评论', '涨粉', '转化', '综合'];

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isTaskUnderstandingResult(value: unknown): value is TaskUnderstandingResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.task_type !== 'string' || !TASK_TYPES.includes(record.task_type as TaskType)) {
    return false;
  }

  if (record.suitable_structure !== undefined && typeof record.suitable_structure !== 'string') {
    return false;
  }

  if (
    record.reference_focus !== undefined
    && (
      !Array.isArray(record.reference_focus)
      || record.reference_focus.some((item) => typeof item !== 'string' || !REFERENCE_FOCUS_VALUES.includes(item as ReferenceFocus))
    )
  ) {
    return false;
  }

  if (record.notes !== undefined && typeof record.notes !== 'string') {
    return false;
  }

  if (typeof record.rewritten_query !== 'string') {
    return false;
  }

  if (record.goal !== undefined && (typeof record.goal !== 'string' || !TASK_GOALS.includes(record.goal as TaskGoal))) {
    return false;
  }

  if (!record.search_filters || typeof record.search_filters !== 'object' || Array.isArray(record.search_filters)) {
    return false;
  }

  const filters = record.search_filters as Record<string, unknown>;
  if (typeof filters.track !== 'string') {
    return false;
  }

  if (filters.content_type !== undefined && !isStringArray(filters.content_type)) {
    return false;
  }

  if (filters.title_pattern_hints !== undefined && !isStringArray(filters.title_pattern_hints)) {
    return false;
  }

  return true;
}
