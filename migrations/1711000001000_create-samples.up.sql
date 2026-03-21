CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS samples (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  body_text       TEXT NOT NULL,
  source_url      TEXT UNIQUE,
  content_hash    TEXT,
  platform        TEXT DEFAULT 'xiaohongshu',
  manual_notes    TEXT,
  manual_tags     TEXT[],
  status          TEXT DEFAULT 'draft',
  is_high_value   BOOLEAN DEFAULT FALSE,
  is_reference_allowed BOOLEAN DEFAULT TRUE,
  engagement_data JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
