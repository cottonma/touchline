-- ============================================================
-- BADGES - Player achievement badges (auto + coach-awarded)
-- ============================================================

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  club_id TEXT REFERENCES clubs(id),
  badge_type TEXT NOT NULL, -- 'first_match', 'ten_appearances', 'first_goal', 'first_assist', 'playmaker', 'hat_trick', 'clean_sheet', 'motm', 'dev_star', 'custom'
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '⭐',
  description TEXT,
  awarded_by TEXT, -- null for automatic, userId for coach-awarded
  fixture_id TEXT REFERENCES fixtures(id), -- optional context
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_badges_player ON badges(player_id);
CREATE INDEX IF NOT EXISTS idx_badges_club ON badges(club_id);
