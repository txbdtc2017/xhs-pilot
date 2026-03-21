import type { JSONSchema7 } from 'json-schema';

export interface VisualAnalysisResult {
  extracted_text: string;
  cover_style_tag: string;
  layout_type_tag: string;
  text_density_tag?: string;
  visual_focus_tag?: string;
  main_colors?: string[];
  sticker_elements?: string[];
  cover_explanation: string;
}

export const visualAnalysisSchema: JSONSchema7 = {
  type: "object",
  properties: {
    extracted_text: { type: "string", description: "从图片中提取的所有文字（OCR）" },
    cover_style_tag: {
      type: "string",
      enum: ["高对比大字", "极简", "拼贴", "手账", "杂志感", "截图式", "实拍", "其他"]
    },
    layout_type_tag: {
      type: "string",
      enum: ["single_focus", "multi_block", "split", "full_text", "grid", "other"]
    },
    text_density_tag: { type: "string", enum: ["low", "medium", "high"] },
    visual_focus_tag: { type: "string", enum: ["headline", "人物", "截图", "对比", "产品", "场景", "other"] },
    main_colors: { type: "array", items: { type: "string" }, description: "主要颜色，如 ['white','red','black']" },
    sticker_elements: { type: "array", items: { type: "string" }, description: "贴图元素，如 ['arrow','highlight']" },
    cover_explanation: { type: "string", description: "封面风格自然语言解读，2~3句" }
  },
  required: ["extracted_text", "cover_style_tag", "layout_type_tag", "cover_explanation"],
  additionalProperties: false
};
