import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Touchline Database Schema
 * 
 * All IDs use nanoid (text) for portability and future migration to PostgreSQL.
 * Timestamps are stored as ISO 8601 strings.
 * JSON fields are stored as TEXT and parsed at the application layer.
 */

// ============================================================
// CLUB & SEASON
// ============================================================

export const clubs = sqliteTable('clubs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  teamName: text('team_name'),
  badgeUrl: text('badge_url'),
  homeGround: text('home_ground'),
  homeGroundAddress: text('home_ground_address'),
  directions: text('directions'),
  kitColourHome: text('kit_colour_home'),
  kitColourAway: text('kit_colour_away'),
  ageGroup: text('age_group'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  clubId: text('club_id').notNull().references(() => clubs.id),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  format: text('format').notNull(), // "5v5" | "7v7" | "9v9" | "11v11"
  matchDurationMinutes: integer('match_duration_minutes').notNull(),
  periods: integer('periods').notNull(), // 2 (halves) or 4 (quarters)
  maxSquadSize: integer('max_squad_size').notNull(),
  formation: text('formation'), // e.g. "2-3-1", nullable
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================================
// PLAYERS
// ============================================================

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  shirtNumber: integer('shirt_number'),
  dateOfBirth: text('date_of_birth'),
  preferredFoot: text('preferred_foot'), // "left" | "right" | "both"
  primaryPosition: text('primary_position').notNull(), // "GK" | "CB" | "LB" | "RB" | "CM" | "LM" | "RM" | "CF"
  secondaryPosition: text('secondary_position'),
  tertiaryPosition: text('tertiary_position'),
  isGkVolunteer: integer('is_gk_volunteer', { mode: 'boolean' }).notNull().default(false),
  photoUrl: text('photo_url'),
  parentName: text('parent_name'),
  parentEmail: text('parent_email'),
  parentPhone: text('parent_phone'),
  medicalNotes: text('medical_notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================================
// FIXTURES
// ============================================================

export const fixtures = sqliteTable('fixtures', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => seasons.id),
  type: text('type').notNull(), // "match" | "training" | "friendly" | "tournament"
  opponent: text('opponent'),
  location: text('location'),
  date: text('date').notNull(),
  kickOffTime: text('kick_off_time'),
  homeAway: text('home_away'), // "home" | "away" | null
  status: text('status').notNull().default('scheduled'), // "scheduled" | "completed" | "cancelled"
  matchObjective: text('match_objective'), // "development" | "balanced" | "competitive"
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================================
// AVAILABILITY
// ============================================================

export const availability = sqliteTable('availability', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  playerId: text('player_id').notNull().references(() => players.id),
  status: text('status').notNull().default('unknown'), // "available" | "unavailable" | "unknown"
  reason: text('reason'),
  updatedAt: text('updated_at').notNull(),
});

// ============================================================
// TEAM SELECTION
// ============================================================

export const teamSelections = sqliteTable('team_selections', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  playerId: text('player_id').notNull().references(() => players.id),
  isSelected: integer('is_selected', { mode: 'boolean' }).notNull().default(false),
  position: text('position'), // Position assigned for this match
  isCaptain: integer('is_captain', { mode: 'boolean' }).notNull().default(false),
  isGk: integer('is_gk', { mode: 'boolean' }).notNull().default(false),
  gkPeriods: text('gk_periods'), // JSON array of period numbers when in goal, e.g. "[1,2]"
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// MATCH EVENTS & PLAYING TIME
// ============================================================

export const matchEvents = sqliteTable('match_events', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  playerId: text('player_id').notNull().references(() => players.id),
  eventType: text('event_type').notNull(), // "goal" | "assist" | "sub_on" | "sub_off" | "gk_start" | "gk_end"
  minute: integer('minute').notNull(),
  period: integer('period'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const playingTime = sqliteTable('playing_time', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  playerId: text('player_id').notNull().references(() => players.id),
  outfieldMinutes: integer('outfield_minutes').notNull().default(0),
  goalkeeperMinutes: integer('goalkeeper_minutes').notNull().default(0),
  totalMinutes: integer('total_minutes').notNull().default(0),
  periodsPlayed: integer('periods_played').notNull().default(0),
  periodsInGoal: integer('periods_in_goal').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// MATCH RESULTS
// ============================================================

export const matchResults = sqliteTable('match_results', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  goalsFor: integer('goals_for').notNull().default(0),
  goalsAgainst: integer('goals_against').notNull().default(0),
  result: text('result'), // "win" | "draw" | "loss"
  coachNotes: text('coach_notes'),
  motmPlayerId: text('motm_player_id').references(() => players.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================================
// GOALS (individual goal records for stats)
// ============================================================

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  scorerId: text('scorer_id').notNull().references(() => players.id),
  assistId: text('assist_id').references(() => players.id),
  minute: integer('minute'),
  period: integer('period'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// COACHING POLICIES
// ============================================================

export const policies = sqliteTable('policies', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // "philosophy" | "playing_time" | "positions" | "goalkeeper" | "match_objective" | "statistics" | "recognition" | "ai_behaviour"
  key: text('key').notNull(),
  value: text('value').notNull(), // JSON stringified value
  description: text('description'),
  updatedAt: text('updated_at').notNull(),
});

// ============================================================
// PLAYER DEVELOPMENT
// ============================================================

export const developmentGoals = sqliteTable('development_goals', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id),
  seasonId: text('season_id').references(() => seasons.id),
  category: text('category').notNull(), // "technical" | "tactical" | "physical" | "psychological"
  positionGroup: text('position_group').notNull(), // "goalkeeper" | "defence" | "central_midfield" | "winger" | "striker" | "all"
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('working_on_it'), // "working_on_it" | "improving" | "achieved"
  targetDate: text('target_date'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const developmentObservations = sqliteTable('development_observations', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').references(() => developmentGoals.id),
  playerId: text('player_id').notNull().references(() => players.id),
  fixtureId: text('fixture_id').references(() => fixtures.id),
  observation: text('observation').notNull(),
  observedAt: text('observed_at').notNull(),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// DEVELOPMENT GOAL LIBRARY (pre-populated templates)
// ============================================================

export const developmentGoalLibrary = sqliteTable('development_goal_library', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // "technical" | "tactical" | "physical" | "psychological"
  positionGroup: text('position_group').notNull(), // "goalkeeper" | "defence" | "central_midfield" | "winger" | "striker" | "all"
  title: text('title').notNull(),
  description: text('description'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// ============================================================
// TRAINING SESSIONS
// ============================================================

export const trainingSessions = sqliteTable('training_sessions', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').references(() => fixtures.id),
  theme: text('theme'),
  objectives: text('objectives'), // JSON array
  plan: text('plan'), // JSON structured plan (array of blocks)
  notes: text('notes'),
  linkedFixtureId: text('linked_fixture_id').references(() => fixtures.id), // upcoming match this session prepares for
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const trainingAttendance = sqliteTable('training_attendance', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  playerId: text('player_id').notNull().references(() => players.id),
  attended: integer('attended', { mode: 'boolean' }).notNull().default(false),
  reason: text('reason'),
});

// ============================================================
// SUBSTITUTION PLANS (generated by engine, editable by coach)
// ============================================================

export const substitutionPlans = sqliteTable('substitution_plans', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  plan: text('plan').notNull(), // JSON: array of periods with on/off pitch players and positions
  isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false),
  generatedBy: text('generated_by').notNull().default('engine'), // "engine" | "ai" | "coach"
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
