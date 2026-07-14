import { z } from 'zod';

const fixtureTypeEnum = z.enum(['match', 'training', 'friendly', 'tournament']);
const fixtureStatusEnum = z.enum(['scheduled', 'completed', 'cancelled']);
const matchObjectiveEnum = z.enum(['development', 'balanced', 'competitive']);
const homeAwayEnum = z.enum(['home', 'away']);

export const fixtureSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  type: fixtureTypeEnum,
  opponent: z.string().nullable(),
  location: z.string().nullable(),
  date: z.string().min(1, 'Date is required'),
  kickOffTime: z.string().nullable(),
  homeAway: homeAwayEnum.nullable(),
  status: fixtureStatusEnum,
  matchObjective: matchObjectiveEnum.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createFixtureSchema = z.object({
  seasonId: z.string().min(1),
  type: fixtureTypeEnum,
  opponent: z.string().optional(),
  location: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  kickOffTime: z.string().optional(),
  homeAway: homeAwayEnum.optional(),
  matchObjective: matchObjectiveEnum.optional(),
  notes: z.string().optional(),
});

export const updateFixtureSchema = createFixtureSchema.partial().omit({ seasonId: true }).extend({
  status: fixtureStatusEnum.optional(),
});
