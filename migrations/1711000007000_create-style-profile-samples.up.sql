CREATE TABLE IF NOT EXISTS style_profile_samples (
  style_profile_id UUID REFERENCES style_profiles(id) ON DELETE CASCADE,
  sample_id        UUID REFERENCES samples(id) ON DELETE CASCADE,
  weight           FLOAT DEFAULT 1.0,
  PRIMARY KEY (style_profile_id, sample_id)
);
