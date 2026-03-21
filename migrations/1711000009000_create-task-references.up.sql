CREATE TABLE IF NOT EXISTS task_references (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES generation_tasks(id) ON DELETE CASCADE,
  sample_id       UUID REFERENCES samples(id),
  reference_type  TEXT NOT NULL,
  reason          TEXT
);
