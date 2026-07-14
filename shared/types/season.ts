/**
 * Season types - represents a football season with format configuration.
 */

import type { MatchFormat } from './enums.js';

export interface Season {
  id: string;
  clubId: string;
  name: string;
  startDate: string;
  endDate: string;
  format: MatchFormat;
  matchDurationMinutes: number;
  periods: number;
  maxSquadSize: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasonInput {
  clubId: string;
  name: string;
  startDate: string;
  endDate: string;
  format: MatchFormat;
  matchDurationMinutes: number;
  periods: number;
  maxSquadSize: number;
}

export interface UpdateSeasonInput extends Partial<Omit<CreateSeasonInput, 'clubId'>> {
  isActive?: boolean;
}
