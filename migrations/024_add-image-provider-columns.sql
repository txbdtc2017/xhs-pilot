-- Up Migration
ALTER TABLE image_plans
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai';

ALTER TABLE image_plans
  ADD COLUMN IF NOT EXISTS provider_model TEXT NOT NULL DEFAULT 'gpt-image-1';

ALTER TABLE image_generation_jobs
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai';

UPDATE image_generation_jobs jobs
SET provider = plans.provider
FROM image_plans plans
WHERE plans.id = jobs.plan_id;

ALTER TABLE image_plans
  DROP CONSTRAINT IF EXISTS image_plans_provider_check;

ALTER TABLE image_plans
  ADD CONSTRAINT image_plans_provider_check CHECK (provider IN ('openai', 'google_vertex'));

ALTER TABLE image_generation_jobs
  DROP CONSTRAINT IF EXISTS image_generation_jobs_provider_check;

ALTER TABLE image_generation_jobs
  ADD CONSTRAINT image_generation_jobs_provider_check CHECK (provider IN ('openai', 'google_vertex'));

-- Down Migration
ALTER TABLE image_generation_jobs
  DROP CONSTRAINT IF EXISTS image_generation_jobs_provider_check;

ALTER TABLE image_plans
  DROP CONSTRAINT IF EXISTS image_plans_provider_check;

ALTER TABLE image_generation_jobs
  DROP COLUMN IF EXISTS provider;

ALTER TABLE image_plans
  DROP COLUMN IF EXISTS provider_model;

ALTER TABLE image_plans
  DROP COLUMN IF EXISTS provider;
