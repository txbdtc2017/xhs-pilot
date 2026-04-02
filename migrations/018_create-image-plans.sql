-- Up Migration
CREATE TABLE IF NOT EXISTS image_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  output_id UUID NOT NULL REFERENCES generation_outputs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ready',
  visual_direction_override TEXT,
  body_page_cap INT NOT NULL DEFAULT 4 CHECK (body_page_cap BETWEEN 1 AND 8),
  cover_candidate_count INT NOT NULL DEFAULT 2 CHECK (cover_candidate_count BETWEEN 1 AND 4),
  body_candidate_count INT NOT NULL DEFAULT 1 CHECK (body_candidate_count BETWEEN 1 AND 3),
  system_decision_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  superseded_at TIMESTAMPTZ
);

-- Down Migration
DROP TABLE IF EXISTS image_plans;
