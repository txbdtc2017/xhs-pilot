-- Up Migration
CREATE TABLE IF NOT EXISTS sample_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id       UUID REFERENCES samples(id) ON DELETE CASCADE,
  embedding_type  TEXT NOT NULL,
  embedding       vector(1536),
  model_version   TEXT DEFAULT 'text-embedding-3-small',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS sample_embeddings;
