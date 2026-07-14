import { api } from '@/lib/api';

/**
 * Fixture API service - communicates with the backend fixture endpoints.
 */

export interface Fixture {
  id: string;
  seasonId: string;
  type: 'match' | 'training' | 'friendly' | 'tournament';
  opponent: string | null;
  location: string | null;
  date: string;
  kickOffTime: string | null;
  homeAway: 'home' | 'away' | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  matchObjective: 'development' | 'balanced' | 'competitive' | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixtureInput {
  seasonId: string;
  type: 'match' | 'training' | 'friendly' | 'tournament';
  opponent?: string;
  location?: string;
  date: string;
  kickOffTime?: string;
  homeAway?: 'home' | 'away';
  matchObjective?: 'development' | 'balanced' | 'competitive';
  notes?: string;
}

export interface UpdateFixtureInput {
  type?: 'match' | 'training' | 'friendly' | 'tournament';
  opponent?: string | null;
  location?: string | null;
  date?: string;
  kickOffTime?: string | null;
  homeAway?: 'home' | 'away' | null;
  status?: 'scheduled' | 'completed' | 'cancelled';
  matchObjective?: 'development' | 'balanced' | 'competitive' | null;
  notes?: string | null;
}

interface FixturesResponse {
  data: Fixture[];
  count: number;
}

interface FixtureResponse {
  data: Fixture;
}

interface NextFixtureResponse {
  data: Fixture | null;
}

export const fixtureApi = {
  getAll: (params?: { seasonId?: string; type?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.seasonId) query.set('seasonId', params.seasonId);
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return api.get<FixturesResponse>(`/fixtures${qs ? `?${qs}` : ''}`);
  },

  getNext: (seasonId?: string) => {
    const qs = seasonId ? `?seasonId=${seasonId}` : '';
    return api.get<NextFixtureResponse>(`/fixtures/next${qs}`);
  },

  getById: (id: string) =>
    api.get<FixtureResponse>(`/fixtures/${id}`),

  create: (data: CreateFixtureInput) =>
    api.post<FixtureResponse>('/fixtures', data),

  update: (id: string, data: UpdateFixtureInput) =>
    api.put<FixtureResponse>(`/fixtures/${id}`, data),

  cancel: (id: string) =>
    api.post<FixtureResponse>(`/fixtures/${id}/cancel`),

  delete: (id: string) =>
    api.delete<{ data: { message: string } }>(`/fixtures/${id}`),
};
