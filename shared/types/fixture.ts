/**
 * Fixture types - represents matches, training sessions, etc.
 */

import type { FixtureType, FixtureStatus, MatchObjective, HomeAway } from './enums.js';

export interface Fixture {
  id: string;
  seasonId: string;
  type: FixtureType;
  opponent: string | null;
  location: string | null;
  date: string;
  kickOffTime: string | null;
  homeAway: HomeAway | null;
  status: FixtureStatus;
  matchObjective: MatchObjective | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixtureInput {
  seasonId: string;
  type: FixtureType;
  opponent?: string;
  location?: string;
  date: string;
  kickOffTime?: string;
  homeAway?: HomeAway;
  matchObjective?: MatchObjective;
  notes?: string;
}

export interface UpdateFixtureInput extends Partial<Omit<CreateFixtureInput, 'seasonId'>> {
  status?: FixtureStatus;
}
