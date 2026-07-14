import { api } from '@/lib/api';

/**
 * Team Selection API service.
 */

export interface PeriodPlayer {
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number; // minute within the period this player comes on (0 = start)
  endMinute: number;   // minute within the period this player goes off (periodDuration = end)
}

export interface PeriodPlan {
  period: number;
  startMinute: number;
  endMinute: number;
  onPitch: PeriodPlayer[];
  offPitch: string[];
  gkPlayerId: string;
}

export interface PlayerTimeSummary {
  playerId: string;
  playerName: string;
  outfieldMinutes: number;
  gkMinutes: number;
  totalMinutes: number;
  periodsPlayed: number;
  periodsOnBench: number;
  periodsInGoal: number;
}

export interface GkAssignment {
  playerId: string;
  periods: number[];
}

export interface SubstitutionEvent {
  minute: number;        // match minute when the sub happens
  periodMinute: number;  // minute within the period
  period: number;
  playerOffId: string;
  playerOnId: string;
}

export interface SubstitutionPlan {
  periods: PeriodPlan[];
  substitutions: SubstitutionEvent[];
  summary: PlayerTimeSummary[];
  gkAssignments: GkAssignment[];
  isValid: boolean;
  validationErrors: string[];
}

export interface EngineConfig {
  matchDurationMinutes: number;
  periods: number;
  outfieldSlots: number;
  toleranceMinutes: number;
  formation?: string | null;
}

export interface PlayerForSelection {
  id: string;
  firstName: string;
  lastName: string;
  primaryPosition: string;
  secondaryPosition?: string | null;
  tertiaryPosition?: string | null;
}

export interface TeamSelectionResult {
  fixtureId: string;
  plan: SubstitutionPlan;
  availablePlayers: PlayerForSelection[];
  config: EngineConfig;
}

interface TeamSelectionResponse {
  data: TeamSelectionResult;
}

interface ApproveResponse {
  data: { id: string };
  message: string;
}

interface GetApprovedResponse {
  data: {
    plan: SubstitutionPlan;
    config: EngineConfig;
    availablePlayers: PlayerForSelection[];
    generatedBy: string;
  } | null;
}

export const teamSelectionApi = {
  /** Generate a new substitution plan */
  generate: (fixtureId: string, gkAssignments?: GkAssignment[]) =>
    api.post<TeamSelectionResponse>(`/fixtures/${fixtureId}/team-selection/generate`, 
      gkAssignments ? { gkAssignments } : undefined
    ),

  /** Approve (save) the current plan */
  approve: (fixtureId: string, data: {
    plan: SubstitutionPlan;
    config: EngineConfig;
    availablePlayers: PlayerForSelection[];
    generatedBy: 'engine' | 'coach';
  }) =>
    api.post<ApproveResponse>(`/fixtures/${fixtureId}/team-selection/approve`, data),

  /** Get the approved plan for a fixture */
  getApproved: (fixtureId: string) =>
    api.get<GetApprovedResponse>(`/fixtures/${fixtureId}/team-selection`),

  /** Regenerate plan with excluded players */
  regenerate: (fixtureId: string, excludePlayerIds: string[], gkAssignments?: GkAssignment[]) =>
    api.post<TeamSelectionResponse>(`/fixtures/${fixtureId}/team-selection/regenerate`, {
      excludePlayerIds,
      ...(gkAssignments ? { gkAssignments } : {}),
    }),
};
