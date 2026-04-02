-- Up Migration
CREATE TABLE IF NOT EXISTS image_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_page_id UUID NOT NULL REFERENCES image_plan_pages(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES image_generation_jobs(id) ON DELETE CASCADE,
  candidate_index INT NOT NULL,
  storage_key TEXT,
  image_url TEXT,
  mime_type TEXT,
  width INT,
  height INT,
  status TEXT NOT NULL DEFAULT 'generated',
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_text_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS image_assets;
