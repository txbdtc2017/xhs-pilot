CREATE TABLE IF NOT EXISTS generation_outputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES generation_tasks(id) ON DELETE CASCADE,
  titles          JSONB,
  openings        JSONB,
  body_versions   JSONB,
  cta_versions    JSONB,
  cover_copies    JSONB,
  hashtags        TEXT[],
  first_comment   TEXT,
  image_suggestions TEXT,
  model_name      TEXT,
  version         INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
