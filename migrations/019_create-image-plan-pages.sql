-- Up Migration
CREATE TABLE IF NOT EXISTS image_plan_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES image_plans(id) ON DELETE CASCADE,
  sort_order INT NOT NULL,
  page_role TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  content_purpose TEXT NOT NULL,
  source_excerpt TEXT NOT NULL,
  visual_type TEXT NOT NULL,
  style_reason TEXT NOT NULL,
  prompt_summary TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  candidate_count INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS image_plan_pages;
