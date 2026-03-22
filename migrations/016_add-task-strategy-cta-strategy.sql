-- Up Migration
ALTER TABLE task_strategy
ADD COLUMN IF NOT EXISTS cta_strategy TEXT;

-- Down Migration
ALTER TABLE task_strategy
DROP COLUMN IF EXISTS cta_strategy;
