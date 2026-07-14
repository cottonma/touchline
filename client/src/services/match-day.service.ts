import { api } from '@/lib/api';

/**
 * Match Day API service.
 */

export interface MatchResult {
  id: string;
  fixtureId: string;
  goalsFor: number;
  goalsAgainst: number;
  result: 'win' | 'draw' | 'loss';
  coachNotes: string | null;
  motmPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalRecord {
  id: string;
  fixtureId: string;
  scorerId: string;
  assistId: string | null;
  minute: number | null;
  period: number | null;
  notes: string | null;
  createdAt: string;
}

export interface PlayingTimeRecord {
  id: string;
  fixtureId: string;
  playerId: string;
  outfieldMinutes: number;
  goalkeeperMinutes: number;
  totalMinutes: number;
  periodsPlayed: number;
  periodsInGoal: number;
  createdAt: string;
}

export interface MatchDayRecord {
  result: MatchResult | null;
  goals: GoalRecord[];
  playingTime: PlayingTimeRecord[];
}

export interface RecordMatchInput {
  goalsFor: number;
  goalsAgainst: number;
  coachNotes?: string;
  motmPlayerId?: string;
  goals: { scorerId: string; assistId?: string; period?: number; minute?: number }[];
  playingTime: {
    playerId: string;
    outfieldMinutes: number;
    goalkeeperMinutes: number;
    periodsPlayed: number;
    periodsInGoal: number;
  }[];
}

interface MatchDayResponse {
  data: MatchDayRecord;
}

export const matchDayApi = {
  get: (fixtureId: string) =>
    api.get<MatchDayResponse>(`/fixtures/${fixtureId}/match-day`),

  record: (fixtureId: string, data: RecordMatchInput) =>
    api.post<MatchDayResponse>(`/fixtures/${fixtureId}/match-day`, data),
};
