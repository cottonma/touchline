import { z } from 'zod';

export const clubSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Club name is required'),
  teamName: z.string().nullable(),
  badgeUrl: z.string().nullable(),
  homeGround: z.string().nullable(),
  homeGroundAddress: z.string().nullable(),
  directions: z.string().nullable(),
  kitColourHome: z.string().nullable(),
  kitColourAway: z.string().nullable(),
  ageGroup: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createClubSchema = z.object({
  name: z.string().min(1, 'Club name is required'),
  teamName: z.string().optional(),
  badgeUrl: z.string().optional(),
  homeGround: z.string().optional(),
  homeGroundAddress: z.string().optional(),
  directions: z.string().optional(),
  kitColourHome: z.string().optional(),
  kitColourAway: z.string().optional(),
  ageGroup: z.string().optional(),
});

export const updateClubSchema = createClubSchema.partial();
