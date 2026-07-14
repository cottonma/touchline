import { z } from 'zod';

/**
 * Server-side Zod validation schemas for fixture API requests.
 */

const fixtureTypeEnum = z.enum(['match', 'training', 'friendly', 'tournament']);
const fixtureStatusEnum = z.enum(['scheduled', 'completed', 'cancelled']);
const matchObjectiveEnum = z.enum(['development', 'balanced', 'competitive']);
const homeAwayEnum = z.enum(['home', 'away']);

export const createFixtureSchema = z.object({
  seasonId: z.string().min(1, 'Season ID is required'),
  type: fixtureTypeEnum,
  opponent: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  date: z.string().min(1, 'Date is required'),
  kickOffTime: z.string().optional(),
  homeAway: homeAwayEnum.optional(),
  matchObjective: matchObjectiveEnum.optional(),
  notes: z.string().max(500).optional(),
});

export const updateFixtureSchema = z.object({
  type: fixtureTypeEnum.optional(),
  opponent: z.string().max(100).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  date: z.string().min(1).optional(),
  kickOffTime: z.string().nullable().optional(),
  homeAway: homeAwayEnum.nullable().optional(),
  status: fixtureStatusEnum.optional(),
  matchObjective: matchObjectiveEnum.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
