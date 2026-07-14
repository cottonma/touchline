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
}

export interface MatchStats {
  fixtureId: string;
  date: string;
  opponent: string | null;
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
