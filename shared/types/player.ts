/**
 * Player types - represents a player in the squad.
 */

import type { Position, PreferredFoot } from './enums.js';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  dateOfBirth: string | null;
  preferredFoot: PreferredFoot | null;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  isGkVolunteer: boolean;
  photoUrl: string | null;
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  medicalNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlayerInput {
  firstName: string;
  lastName: string;
  shirtNumber?: number;
  dateOfBirth?: string;
  preferredFoot?: PreferredFoot;
  primaryPosition: Position;
  secondaryPosition?: Position;
  isGkVolunteer?: boolean;
  photoUrl?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  medicalNotes?: string;
}

export interface UpdatePlayerInput extends Partial<CreatePlayerInput> {
  isActive?: boolean;
}
