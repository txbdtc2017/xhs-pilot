-- Up Migration
CREATE TABLE IF NOT EXISTS image_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES image_plans(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  plan_page_id UUID REFERENCES image_plan_pages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  total_units INT NOT NULL DEFAULT 0,
  completed_units INT NOT NULL DEFAULT 0,
  error_message TEXT,
  model_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Down Migration
DROP TABLE IF EXISTS image_generation_jobs;
