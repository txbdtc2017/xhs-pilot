-- Up Migration
CREATE TABLE IF NOT EXISTS task_strategy (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID UNIQUE REFERENCES generation_tasks(id) ON DELETE CASCADE,
  strategy_summary    TEXT,
  content_direction   TEXT,
  title_strategy      TEXT,
  opening_strategy    TEXT,
  structure_strategy  TEXT,
  cover_strategy      TEXT,
  warnings            TEXT[],
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS task_strategy;
