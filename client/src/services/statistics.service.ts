import { api } from '@/lib/api';

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  motmAwards: number;
  outfieldMinutes: number;
  goalkeeperMinutes: number;
  totalMinutes: number;
  goalInvolvements: number;
  minutesPerGoal: number | null;
  minutesPerAssist: number | null;
  avgMinutesPerAppearance: number;
  positionsPlayed: string[];
  positionVariety: number;
  gkSharePct: number;
  periodsPlayed: number;
}

export interface TeamSeasonStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  winPercentage: number;
  periods?: number;
}

export interface MatchStats {
  fixtureId: string;
  date: string;
  opponent: string | null;
  homeAway: string | null;
  goalsFor: number;
  goalsAgainst: number;
  result: string | null;
}

export const statsApi = {
  getPlayerStats: () => api.get<{ data: PlayerSeasonStats[] }>('/stats/players'),
  getPlayerStatById: (id: string) => api.get<{ data: PlayerSeasonStats }>(`/stats/players/${id}`),
  getTeamStats: () => api.get<{ data: TeamSeasonStats }>('/stats/team'),
  getResults: () => api.get<{ data: MatchStats[]; count: number }>('/stats/results'),
};
