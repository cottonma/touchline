/**
 * Shared constants used across the application.
 */

/** Match format configurations */
export const MATCH_FORMATS = {
  '5v5': { playersOnPitch: 5, outfieldPlayers: 4, typicalSquad: 8 },
  '7v7': { playersOnPitch: 7, outfieldPlayers: 6, typicalSquad: 12 },
  '9v9': { playersOnPitch: 9, outfieldPlayers: 8, typicalSquad: 14 },
  '11v11': { playersOnPitch: 11, outfieldPlayers: 10, typicalSquad: 16 },
} as const;

/** Position labels for display */
export const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper',
  CB: 'Centre Back',
  LB: 'Left Back',
  RB: 'Right Back',
  CM: 'Central Midfield',
  LM: 'Left Midfield',
  RM: 'Right Midfield',
  CF: 'Centre Forward',
};

/** Position group labels (includes 'all' for development goals) */
export const POSITION_GROUP_LABELS: Record<string, string> = {
  ...POSITION_LABELS,
  all: 'All Positions',
};

/** Development category labels */
export const DEVELOPMENT_CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  tactical: 'Tactical',
  physical: 'Physical',
  psychological: 'Psychological',
};

/** Development status labels */
export const DEVELOPMENT_STATUS_LABELS: Record<string, string> = {
  working_on_it: 'Working on it',
  improving: 'Improving',
  achieved: 'Achieved',
};

/** Availability status labels */
export const AVAILABILITY_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
};

/** Match objective labels */
export const MATCH_OBJECTIVE_LABELS: Record<string, string> = {
  development: 'Development',
  balanced: 'Balanced',
  competitive: 'Competitive',
};

/** Coaching philosophy labels */
export const COACHING_PHILOSOPHY_LABELS: Record<string, string> = {
  development: 'Development First',
  balanced: 'Balanced',
  competitive: 'Competitive',
};

/** Playing time tolerance in minutes */
export const PLAYING_TIME_TOLERANCE_MINUTES = 2;

/** Minimum consecutive quarters a player must not sit out */
export const MAX_CONSECUTIVE_BENCH_PERIODS = 1;

/** Training block type labels */
export const TRAINING_BLOCK_LABELS: Record<string, string> = {
  warm_up: 'Warm Up',
  technical_drill: 'Technical Drill',
  tactical_drill: 'Tactical Drill',
  small_sided_game: 'Small-Sided Game',
  match: 'Match / Scrimmage',
  cool_down: 'Cool Down',
  discussion: 'Discussion / Debrief',
};
