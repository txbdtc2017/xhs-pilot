CREATE TABLE IF NOT EXISTS sample_visual_analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id       UUID UNIQUE REFERENCES samples(id) ON DELETE CASCADE,

  -- 枚举标签
  cover_style_tag     TEXT,
  layout_type_tag     TEXT,
  text_density_tag    TEXT,
  visual_focus_tag    TEXT,

  -- 结构化数据
  main_colors         TEXT[],
  sticker_elements    TEXT[],

  -- 自然语言摘要
  cover_explanation   TEXT,

  model_name    TEXT,
  analyzed_at   TIMESTAMPTZ DEFAULT NOW()
);
