-- Up Migration
ALTER TABLE generation_outputs
  ADD CONSTRAINT generation_outputs_task_id_version_key UNIQUE (task_id, version);

ALTER TABLE image_plan_pages
  ADD CONSTRAINT image_plan_pages_plan_id_sort_order_key UNIQUE (plan_id, sort_order);

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_job_id_plan_page_id_candidate_index_key
  UNIQUE (job_id, plan_page_id, candidate_index);

CREATE UNIQUE INDEX IF NOT EXISTS image_plans_single_active_per_output_idx
  ON image_plans (output_id)
  WHERE superseded_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_single_selected_per_page_idx
  ON image_assets (plan_page_id)
  WHERE is_selected = TRUE;

CREATE INDEX IF NOT EXISTS image_generation_jobs_plan_created_at_idx
  ON image_generation_jobs (plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS image_job_events_job_id_id_idx
  ON image_job_events (job_id, id ASC);

CREATE INDEX IF NOT EXISTS image_assets_plan_page_created_at_idx
  ON image_assets (plan_page_id, created_at DESC);

-- Down Migration
DROP INDEX IF EXISTS image_assets_plan_page_created_at_idx;
DROP INDEX IF EXISTS image_job_events_job_id_id_idx;
DROP INDEX IF EXISTS image_generation_jobs_plan_created_at_idx;
DROP INDEX IF EXISTS image_assets_single_selected_per_page_idx;
DROP INDEX IF EXISTS image_plans_single_active_per_output_idx;

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_job_id_plan_page_id_candidate_index_key;

ALTER TABLE image_plan_pages
  DROP CONSTRAINT IF EXISTS image_plan_pages_plan_id_sort_order_key;

ALTER TABLE generation_outputs
  DROP CONSTRAINT IF EXISTS generation_outputs_task_id_version_key;
