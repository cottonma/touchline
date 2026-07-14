import { z } from 'zod';

/**
 * Server-side Zod validation schemas for player API requests.
 */

const positionEnum = z.enum(['GK', 'CB', 'LB', 'RB', 'CM', 'LM', 'RM', 'CF']);
const preferredFootEnum = z.enum(['left', 'right', 'both']);

export const createPlayerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  shirtNumber: z.number().int().min(1).max(99).optional(),
  dateOfBirth: z.string().optional(),
  preferredFoot: preferredFootEnum.optional(),
  primaryPosition: positionEnum,
  secondaryPosition: positionEnum.optional(),
  tertiaryPosition: positionEnum.optional(),
  isGkVolunteer: z.boolean().optional().default(false),
  photoUrl: z.string().url().optional(),
  parentName: z.string().max(100).optional(),
  parentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  parentPhone: z.string().max(20).optional(),
  medicalNotes: z.string().max(500).optional(),
});

export const updatePlayerSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  shirtNumber: z.number().int().min(1).max(99).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  preferredFoot: preferredFootEnum.nullable().optional(),
  primaryPosition: positionEnum.optional(),
  secondaryPosition: positionEnum.nullable().optional(),
  tertiaryPosition: positionEnum.nullable().optional(),
  isGkVolunteer: z.boolean().optional(),
  photoUrl: z.string().url().nullable().optional(),
  parentName: z.string().max(100).nullable().optional(),
  parentEmail: z.string().email().nullable().optional().or(z.literal('')),
  parentPhone: z.string().max(20).nullable().optional(),
  medicalNotes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});
