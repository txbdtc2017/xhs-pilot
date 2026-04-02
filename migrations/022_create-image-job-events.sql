-- Up Migration
CREATE TABLE IF NOT EXISTS image_job_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES image_generation_jobs(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS image_job_events;
