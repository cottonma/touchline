import { z } from 'zod';

const positionEnum = z.enum(['GK', 'CB', 'LB', 'RB', 'CM', 'LM', 'RM', 'CF']);
const preferredFootEnum = z.enum(['left', 'right', 'both']);

export const playerSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  shirtNumber: z.number().int().min(1).max(99).nullable(),
  dateOfBirth: z.string().nullable(),
  preferredFoot: preferredFootEnum.nullable(),
  primaryPosition: positionEnum,
  secondaryPosition: positionEnum.nullable(),
  tertiaryPosition: positionEnum.nullable(),
  isGkVolunteer: z.boolean(),
  photoUrl: z.string().nullable(),
  parentName: z.string().nullable(),
  parentEmail: z.string().email().nullable().or(z.literal('')),
  parentPhone: z.string().nullable(),
  medicalNotes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createPlayerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  shirtNumber: z.number().int().min(1).max(99).optional(),
  dateOfBirth: z.string().optional(),
  preferredFoot: preferredFootEnum.optional(),
  primaryPosition: positionEnum,
  secondaryPosition: positionEnum.optional(),
  tertiaryPosition: positionEnum.optional(),
  isGkVolunteer: z.boolean().optional().default(false),
  photoUrl: z.string().optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  parentPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
});

export const updatePlayerSchema = createPlayerSchema.partial().extend({
  isActive: z.boolean().optional(),
});
