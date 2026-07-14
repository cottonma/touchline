-- Touchline MVP 0.1 - Initial Schema
-- Created: 2026-07-04

-- ============================================================
-- CLUB & SEASON
-- ============================================================

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team_name TEXT,
  badge_url TEXT,
  home_ground TEXT,
  home_ground_address TEXT,
  directions TEXT,
  kit_colour_home TEXT,
  kit_colour_away TEXT,
  age_group TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  format TEXT NOT NULL,
  match_duration_minutes INTEGER NOT NULL,
  periods INTEGER NOT NULL,
  max_squad_size INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- PLAYERS
-- ============================================================

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  shirt_number INTEGER,
  date_of_birth TEXT,
  preferred_foot TEXT,
  primary_position TEXT NOT NULL,
  secondary_position TEXT,
  is_gk_volunteer INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  medical_notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- FIXTURES
-- ============================================================

CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  type TEXT NOT NULL,
  opponent TEXT,
  location TEXT,
  date TEXT NOT NULL,
  kick_off_time TEXT,
  home_away TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  match_objective TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- AVAILABILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS availability (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'unknown',
  reason TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(fixture_id, player_id)
);

-- ============================================================
-- TEAM SELECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS team_selections (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  is_selected INTEGER NOT NULL DEFAULT 0,
  position TEXT,
  is_captain INTEGER NOT NULL DEFAULT 0,
  is_gk INTEGER NOT NULL DEFAULT 0,
  gk_periods TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(fixture_id, player_id)
);

-- ============================================================
-- MATCH EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  event_type TEXT NOT NULL,
  minute INTEGER NOT NULL,
  period INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================
-- PLAYING TIME
-- ============================================================

CREATE TABLE IF NOT EXISTS playing_time (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  outfield_minutes INTEGER NOT NULL DEFAULT 0,
  goalkeeper_minutes INTEGER NOT NULL DEFAULT 0,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  periods_played INTEGER NOT NULL DEFAULT 0,
  periods_in_goal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(fixture_id, player_id)
);

-- ============================================================
-- MATCH RESULTS
-- ============================================================

CREATE TABLE IF NOT EXISTS match_results (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) UNIQUE,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  coach_notes TEXT,
  motm_player_id TEXT REFERENCES players(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- GOALS
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  scorer_id TEXT NOT NULL REFERENCES players(id),
  assist_id TEXT REFERENCES players(id),
  minute INTEGER,
  period INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================
-- COACHING POLICIES
-- ============================================================

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(category, key)
);

-- ============================================================
-- PLAYER DEVELOPMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS development_goals (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  season_id TEXT REFERENCES seasons(id),
  category TEXT NOT NULL,
  position_group TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'working_on_it',
  target_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS development_observations (
  id TEXT PRIMARY KEY,
  goal_id TEXT REFERENCES development_goals(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  fixture_id TEXT REFERENCES fixtures(id),
  observation TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS development_goal_library (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  position_group TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============================================================
-- TRAINING
-- ============================================================

CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  fixture_id TEXT REFERENCES fixtures(id),
  theme TEXT,
  objectives TEXT,
  plan TEXT,
  notes TEXT,
  linked_fixture_id TEXT REFERENCES fixtures(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_attendance (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  attended INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  UNIQUE(fixture_id, player_id)
);

-- ============================================================
-- SUBSTITUTION PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS substitution_plans (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  plan TEXT NOT NULL,
  is_approved INTEGER NOT NULL DEFAULT 0,
  generated_by TEXT NOT NULL DEFAULT 'engine',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_seasons_club_id ON seasons(club_id);
CREATE INDEX IF NOT EXISTS idx_seasons_is_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_players_is_active ON players(is_active);
CREATE INDEX IF NOT EXISTS idx_fixtures_season_id ON fixtures(season_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_date ON fixtures(date);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);
CREATE INDEX IF NOT EXISTS idx_availability_fixture_id ON availability(fixture_id);
CREATE INDEX IF NOT EXISTS idx_availability_player_id ON availability(player_id);
CREATE INDEX IF NOT EXISTS idx_team_selections_fixture_id ON team_selections(fixture_id);
CREATE INDEX IF NOT EXISTS idx_playing_time_fixture_id ON playing_time(fixture_id);
CREATE INDEX IF NOT EXISTS idx_playing_time_player_id ON playing_time(player_id);
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_id ON match_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_goals_fixture_id ON goals(fixture_id);
CREATE INDEX IF NOT EXISTS idx_goals_scorer_id ON goals(scorer_id);
CREATE INDEX IF NOT EXISTS idx_development_goals_player_id ON development_goals(player_id);
CREATE INDEX IF NOT EXISTS idx_development_observations_player_id ON development_observations(player_id);
CREATE INDEX IF NOT EXISTS idx_training_attendance_fixture_id ON training_attendance(fixture_id);
CREATE INDEX IF NOT EXISTS idx_substitution_plans_fixture_id ON substitution_plans(fixture_id);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
