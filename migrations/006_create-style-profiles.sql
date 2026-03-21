-- Up Migration
CREATE TABLE IF NOT EXISTS style_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  applicable_goals  TEXT[],
  title_rules       TEXT[],
  opening_rules     TEXT[],
  structure_rules   TEXT[],
  cover_rules       TEXT[],
  avoid_rules       TEXT[],
  auto_summary      TEXT,
  sample_count      INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS style_profiles;
