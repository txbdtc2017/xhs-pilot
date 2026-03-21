-- 创建向量检索索引
-- 注意：对于 ivfflat 索引，建议在表中有一定量数据后再创建，或者在迁移中先占位
-- 这里直接创建，后续如果数据量极大可能需要 REINDEX
CREATE INDEX IF NOT EXISTS sample_embeddings_v_idx ON sample_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 其他常用索引
CREATE INDEX IF NOT EXISTS samples_status_idx ON samples(status);
CREATE INDEX IF NOT EXISTS samples_is_high_value_idx ON samples(is_high_value);
CREATE INDEX IF NOT EXISTS sample_images_sample_id_idx ON sample_images(sample_id);
CREATE INDEX IF NOT EXISTS sample_analysis_sample_id_idx ON sample_analysis(sample_id);
CREATE INDEX IF NOT EXISTS sample_embeddings_sample_id_idx ON sample_embeddings(sample_id);
CREATE INDEX IF NOT EXISTS generation_tasks_status_idx ON generation_tasks(status);
