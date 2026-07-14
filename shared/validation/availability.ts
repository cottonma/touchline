import { z } from 'zod';

const availabilityStatusEnum = z.enum(['available', 'unavailable', 'unknown']);

export const availabilitySchema = z.object({
  id: z.string(),
  fixtureId: z.string(),
  playerId: z.string(),
  status: availabilityStatusEnum,
  reason: z.string().nullable(),
  updatedAt: z.string(),
});

export const updateAvailabilitySchema = z.object({
  fixtureId: z.string().min(1),
  playerId: z.string().min(1),
  status: availabilityStatusEnum,
  reason: z.string().optional(),
});
