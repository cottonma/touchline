-- ============================================================
-- MATCH PLANS - Visual match planning (replaces substitution_plans)
-- ============================================================

CREATE TABLE IF NOT EXISTS match_plans (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) UNIQUE,
  club_id TEXT REFERENCES clubs(id),
  status TEXT NOT NULL DEFAULT 'draft',
  formation TEXT,
  periods INTEGER NOT NULL,
  period_duration_minutes NUMERIC NOT NULL,
  match_duration_minutes INTEGER NOT NULL,
  outfield_slots INTEGER NOT NULL,
  generated_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_plan_slots (
  id TEXT PRIMARY KEY,
  match_plan_id TEXT NOT NULL REFERENCES match_plans(id) ON DELETE CASCADE,
  period INTEGER NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  position TEXT NOT NULL,
  is_gk BOOLEAN NOT NULL DEFAULT false,
  start_minute INTEGER NOT NULL DEFAULT 0,
  end_minute INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_slots_plan_period ON match_plan_slots(match_plan_id, period);
CREATE INDEX IF NOT EXISTS idx_plan_slots_player ON match_plan_slots(player_id);
