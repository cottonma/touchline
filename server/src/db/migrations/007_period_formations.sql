-- ============================================================
-- Period-level formations — allows different formation per quarter
-- ============================================================

-- JSON object: {"1": "2-3-1", "2": "1-4-1", "3": "1-3-2", "4": "2-3-1"}
ALTER TABLE match_plans ADD COLUMN IF NOT EXISTS period_formations TEXT;
