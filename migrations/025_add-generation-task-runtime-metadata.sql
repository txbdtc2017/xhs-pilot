-- Up Migration
ALTER TABLE generation_tasks
ADD COLUMN IF NOT EXISTS current_step TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stalled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stalled_reason TEXT,
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

UPDATE generation_tasks
SET
  current_step = CASE
    WHEN status IN ('understanding', 'searching', 'strategizing', 'generating', 'persisting')
      THEN status
    ELSE current_step
  END,
  status = CASE
    WHEN status = 'pending' THEN 'queued'
    WHEN status IN ('understanding', 'searching', 'strategizing', 'generating', 'persisting')
      THEN 'running'
    ELSE status
  END
WHERE status IN ('pending', 'understanding', 'searching', 'strategizing', 'generating', 'persisting');

-- Down Migration
UPDATE generation_tasks
SET status = 'pending'
WHERE status = 'queued';

ALTER TABLE generation_tasks
DROP COLUMN IF EXISTS failure_reason,
DROP COLUMN IF EXISTS stalled_reason,
DROP COLUMN IF EXISTS failed_at,
DROP COLUMN IF EXISTS stalled_at,
DROP COLUMN IF EXISTS last_heartbeat_at,
DROP COLUMN IF EXISTS last_progress_at,
DROP COLUMN IF EXISTS started_at,
DROP COLUMN IF EXISTS current_step;
