-- ============================================================
-- MATCH PLAN VERSIONS - Saved snapshots of match plans
-- ============================================================

CREATE TABLE IF NOT EXISTS match_plan_versions (
  id TEXT PRIMARY KEY,
  match_plan_id TEXT NOT NULL REFERENCES match_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slots_snapshot TEXT NOT NULL,  -- JSON array of slot data
  formation TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  generated_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON match_plan_versions(match_plan_id);
