-- Up Migration
CREATE TABLE IF NOT EXISTS sample_analysis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id           UUID UNIQUE REFERENCES samples(id) ON DELETE CASCADE,

  -- 枚举标签（用于检索和统计）
  track               TEXT,
  content_type        TEXT,
  title_pattern_tags  TEXT[],
  opening_pattern_tags TEXT[],
  structure_pattern_tags TEXT[],
  emotion_level       INT,
  trust_signal_tags   TEXT[],
  cta_type_tags       TEXT[],

  -- 自然语言摘要（用于注入生成 prompt）
  title_pattern_explanation   TEXT,
  opening_explanation         TEXT,
  structure_explanation       TEXT,
  replicable_rules            TEXT[],
  avoid_points                TEXT[],
  reasoning_summary           TEXT,

  model_name    TEXT,
  analyzed_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS sample_analysis;
