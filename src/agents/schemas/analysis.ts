import type { JSONSchema7 } from 'json-schema';

export interface AnalysisResult {
  track: string;
  content_type: string;
  title_pattern_tags: string[];
  opening_pattern_tags?: string[];
  structure_pattern_tags?: string[];
  emotion_level: number;
  trust_signal_tags?: string[];
  cta_type_tags?: string[];
  title_pattern_explanation: string;
  opening_explanation?: string;
  structure_explanation: string;
  replicable_rules: string[];
  avoid_points?: string[];
  reasoning_summary: string;
}

export const analysisSchema: JSONSchema7 = {
  type: "object",
  properties: {
    track: {
      type: "string",
      enum: ["职场", "情感", "学习", "工具", "穿搭", "美妆", "美食", "旅行", "育儿", "健康", "理财", "科技", "其他"],
      description: "内容赛道"
    },
    content_type: {
      type: "string",
      enum: ["清单", "经验", "避坑", "观点", "故事", "教程", "测评", "盘点", "对比", "其他"],
      description: "内容类型"
    },
    title_pattern_tags: {
      type: "array",
      items: {
        type: "string",
        enum: ["数字型", "结果先行", "反差对比", "提问式", "恐吓警告", "身份代入", "时间限定", "悬念型", "情绪共鸣", "其他"]
      },
      description: "标题模式标签，可多选"
    },
    opening_pattern_tags: {
      type: "array",
      items: {
        type: "string",
        enum: ["痛点切入", "结果前置", "故事开头", "数据开头", "提问开头", "场景描写", "其他"]
      }
    },
    structure_pattern_tags: {
      type: "array",
      items: {
        type: "string",
        enum: ["清单式", "递进式", "总分总", "对比式", "时间线", "问答式", "故事线", "其他"]
      }
    },
    emotion_level: {
      type: "integer", 
      minimum: 1, 
      maximum: 10,
      description: "情绪强度，1=冷静客观 10=强烈煽动"
    },
    trust_signal_tags: {
      type: "array",
      items: { type: "string", enum: ["真实经历", "数据引用", "专业背景", "细节描写", "对比验证", "其他"] }
    },
    cta_type_tags: {
      type: "array",
      items: { type: "string", enum: ["收藏", "评论引导", "关注", "转发", "点赞", "无明显CTA", "其他"] }
    },
    title_pattern_explanation: { type: "string", description: "标题策略自然语言解读，2~3句" },
    opening_explanation: { type: "string", description: "开头策略自然语言解读" },
    structure_explanation: { type: "string", description: "结构模式自然语言解读" },
    replicable_rules: {
      type: "array", items: { type: "string" },
      description: "可复用的规则/技巧，每条一句话"
    },
    avoid_points: {
      type: "array", items: { type: "string" },
      description: "不建议模仿的点"
    },
    reasoning_summary: { type: "string", description: "综合分析摘要，3~5句话" }
  },
  required: [
    "track", "content_type", "title_pattern_tags", "emotion_level",
    "title_pattern_explanation", "structure_explanation", "replicable_rules", "reasoning_summary"
  ],
  additionalProperties: false
};
