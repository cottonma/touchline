import { z } from 'zod';

const matchFormatEnum = z.enum(['5v5', '7v7', '9v9', '11v11']);

export const seasonSchema = z.object({
  id: z.string(),
  clubId: z.string(),
  name: z.string().min(1, 'Season name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  format: matchFormatEnum,
  matchDurationMinutes: z.number().int().min(10).max(120),
  periods: z.number().int().min(2).max(4),
  maxSquadSize: z.number().int().min(5).max(30),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createSeasonSchema = z.object({
  clubId: z.string().min(1),
  name: z.string().min(1, 'Season name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  format: matchFormatEnum,
  matchDurationMinutes: z.number().int().min(10).max(120),
  periods: z.number().int().min(2).max(4),
  maxSquadSize: z.number().int().min(5).max(30),
});

export const updateSeasonSchema = createSeasonSchema.partial().omit({ clubId: true }).extend({
  isActive: z.boolean().optional(),
});
