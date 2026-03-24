-- Up Migration
ALTER TABLE samples ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE samples DROP COLUMN IF EXISTS deleted_at;
