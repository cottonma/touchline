import { api } from '@/lib/api';

/**
 * Scout Report API service.
 */

export interface KeyPlayer {
  name: string;
  position: string;
  strengths: string;
  threatLevel: number; // 1-5
}

export interface ScoutReport {
  id: string;
  fixtureId: string | null;
  opponent: string;
  scoutName: string | null;
  date: string | null;
  finalScore: string | null;
  // Section 1
  formation: string | null;
  styleOfPlay: string | null; // JSON array
  // Section 2
  keyPlayers: string | null; // JSON array of KeyPlayer
  // Section 3
  attackDirection: string | null;
  chanceCreation: string | null; // JSON array
  attackingNotes: string | null;
  // Section 4
  defensiveStyle: string | null; // JSON array
  weaknesses: string | null; // JSON array
  defensiveNotes: string | null;
  // Section 5
  cornersRating: string | null;
  gkRating: string | null;
  gkDistribution: string | null;
  setPieceNotes: string | null;
  // Section 6
  threats: string | null; // JSON array
  opportunities: string | null; // JSON array
  // Section 7
  attackBy: string | null;
  defendBy: string | null;
  confidenceRating: string | null;
  overallComments: string | null;
  // Section 8
  teamPerformanceRating: number | null;
  teamStrengths: string | null;
  teamWeaknesses: string | null;
  teamNotes: string | null;
  // Meta
  createdAt: string;
  updatedAt: string;
}

export type CreateScoutReportInput = Omit<ScoutReport, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateScoutReportInput = Partial<CreateScoutReportInput>;

interface ScoutReportsResponse {
  data: ScoutReport[];
}

interface ScoutReportResponse {
  data: ScoutReport;
}

export const scoutReportApi = {
  getAll: (params?: { opponent?: string; fixtureId?: string }) => {
    const query = new URLSearchParams();
    if (params?.opponent) query.set('opponent', params.opponent);
    if (params?.fixtureId) query.set('fixtureId', params.fixtureId);
    const qs = query.toString();
    return api.get<ScoutReportsResponse>(`/scout-reports${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string) =>
    api.get<ScoutReportResponse>(`/scout-reports/${id}`),

  create: (data: CreateScoutReportInput) =>
    api.post<ScoutReportResponse>('/scout-reports', data),

  update: (id: string, data: UpdateScoutReportInput) =>
    api.put<ScoutReportResponse>(`/scout-reports/${id}`, data),

  delete: (id: string) =>
    api.delete<{ data: { message: string } }>(`/scout-reports/${id}`),
};
