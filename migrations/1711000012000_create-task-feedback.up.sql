CREATE TABLE IF NOT EXISTS task_feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES generation_tasks(id) ON DELETE CASCADE,
  selected_title_index  INT,
  selected_body_index   INT,
  used_in_publish       BOOLEAN DEFAULT FALSE,
  publish_metrics       JSONB,
  manual_feedback       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
