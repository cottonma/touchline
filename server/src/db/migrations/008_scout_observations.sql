-- ============================================================
-- SCOUT OBSERVATIONS - Per-player and team-level match observations
-- ============================================================

CREATE TABLE IF NOT EXISTS scout_observations (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT REFERENCES players(id),  -- NULL for team-level observations
  scout_id TEXT REFERENCES users(id),
  period INTEGER,                          -- optional: which quarter
  match_minute INTEGER,                    -- optional: minute observed
  development_area TEXT NOT NULL,          -- 'physical' | 'technical' | 'mental' | 'teamwork'
  observation_type TEXT NOT NULL DEFAULT 'general', -- 'strength' | 'development' | 'general'
  observation TEXT NOT NULL,
  follow_up TEXT,                          -- optional coach follow-up note
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scout_obs_fixture ON scout_observations(fixture_id);
CREATE INDEX IF NOT EXISTS idx_scout_obs_player ON scout_observations(player_id);
CREATE INDEX IF NOT EXISTS idx_scout_obs_scout ON scout_observations(scout_id);
