import { z } from 'zod';

/**
 * Server-side Zod validation schemas for availability API requests.
 */

const availabilityStatusEnum = z.enum(['available', 'unavailable', 'unknown']);

export const updateAvailabilitySchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  status: availabilityStatusEnum,
  reason: z.string().max(200).optional(),
});

export const batchUpdateAvailabilitySchema = z.object({
  items: z.array(
    z.object({
      playerId: z.string().min(1),
      status: availabilityStatusEnum,
      reason: z.string().max(200).optional(),
    })
  ).min(1, 'At least one availability update is required'),
});
