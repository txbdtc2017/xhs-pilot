-- Up Migration
CREATE INDEX IF NOT EXISTS sample_embeddings_v_idx ON sample_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS samples_status_idx ON samples(status);
CREATE INDEX IF NOT EXISTS samples_is_high_value_idx ON samples(is_high_value);
CREATE INDEX IF NOT EXISTS sample_images_sample_id_idx ON sample_images(sample_id);
CREATE INDEX IF NOT EXISTS sample_analysis_sample_id_idx ON sample_analysis(sample_id);
CREATE INDEX IF NOT EXISTS sample_embeddings_sample_id_idx ON sample_embeddings(sample_id);
CREATE INDEX IF NOT EXISTS generation_tasks_status_idx ON generation_tasks(status);

-- Down Migration
DROP INDEX IF EXISTS generation_tasks_status_idx;
DROP INDEX IF EXISTS sample_embeddings_sample_id_idx;
DROP INDEX IF EXISTS sample_analysis_sample_id_idx;
DROP INDEX IF EXISTS sample_images_sample_id_idx;
DROP INDEX IF EXISTS samples_is_high_value_idx;
DROP INDEX IF EXISTS samples_status_idx;
DROP INDEX IF EXISTS sample_embeddings_v_idx;
