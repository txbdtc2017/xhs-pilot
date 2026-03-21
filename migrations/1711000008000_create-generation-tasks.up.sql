CREATE TABLE IF NOT EXISTS generation_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL,
  target_audience   TEXT,
  goal              TEXT,
  style_preference  TEXT,
  persona_mode      TEXT DEFAULT 'balanced',
  need_cover_suggestion BOOLEAN DEFAULT TRUE,
  style_profile_id  UUID REFERENCES style_profiles(id),
  status            TEXT DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
