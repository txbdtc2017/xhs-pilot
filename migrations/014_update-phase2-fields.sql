-- Up Migration
ALTER TABLE samples ALTER COLUMN status SET DEFAULT 'pending';
UPDATE samples SET status = 'pending' WHERE status = 'draft';

ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS storage_key TEXT;

ALTER TABLE sample_visual_analysis ADD COLUMN IF NOT EXISTS extracted_text TEXT;

ALTER TABLE sample_embeddings DROP COLUMN IF EXISTS embedding_type;

-- Down Migration
ALTER TABLE sample_embeddings ADD COLUMN IF NOT EXISTS embedding_type TEXT DEFAULT 'title_body';

ALTER TABLE sample_visual_analysis DROP COLUMN IF EXISTS extracted_text;

ALTER TABLE sample_images DROP COLUMN IF EXISTS storage_key;

ALTER TABLE samples ALTER COLUMN status SET DEFAULT 'draft';
