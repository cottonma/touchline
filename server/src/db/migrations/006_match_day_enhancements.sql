-- ============================================================
-- Match Day Enhancements — period scores + richer player records
-- ============================================================

-- Add period_scores JSON to match_results
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS period_scores TEXT;
-- JSON: [{"period":1,"goalsFor":1,"goalsAgainst":0}, ...]

-- Add positions_played and period detail to playing_time
ALTER TABLE playing_time ADD COLUMN IF NOT EXISTS positions_played TEXT;
-- JSON array: ["LM","CM","RB"]

ALTER TABLE playing_time ADD COLUMN IF NOT EXISTS periods_detail TEXT;
-- JSON: [{"period":1,"minutes":15,"position":"LM","isGk":false}, ...]

-- Add updated_at to playing_time for idempotent recalculation
ALTER TABLE playing_time ADD COLUMN IF NOT EXISTS updated_at TEXT;
