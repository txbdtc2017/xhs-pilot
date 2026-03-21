-- Up Migration
CREATE TABLE IF NOT EXISTS sample_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id   UUID REFERENCES samples(id) ON DELETE CASCADE,
  image_type  TEXT NOT NULL,
  image_url   TEXT NOT NULL,
  ocr_text    TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS sample_images;
