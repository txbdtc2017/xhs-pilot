-- Up Migration
ALTER TABLE generation_tasks
ADD COLUMN IF NOT EXISTS reference_mode TEXT;

-- Down Migration
ALTER TABLE generation_tasks
DROP COLUMN IF EXISTS reference_mode;
