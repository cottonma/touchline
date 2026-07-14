import { api } from '@/lib/api';

/**
 * Player API service - communicates with the backend player endpoints.
 */

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  dateOfBirth: string | null;
  preferredFoot: 'left' | 'right' | 'both' | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
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
  preferredFoot?: 'left' | 'right' | 'both';
  primaryPosition: string;
  secondaryPosition?: string;
  tertiaryPosition?: string;
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

interface PlayersResponse {
  data: Player[];
  count: number;
}

interface PlayerResponse {
  data: Player;
}

export const playerApi = {
  getAll: (includeInactive = false) =>
    api.get<PlayersResponse>(`/players${includeInactive ? '?includeInactive=true' : ''}`),

  getById: (id: string) =>
    api.get<PlayerResponse>(`/players/${id}`),

  create: (data: CreatePlayerInput) =>
    api.post<PlayerResponse>('/players', data),

  update: (id: string, data: UpdatePlayerInput) =>
    api.put<PlayerResponse>(`/players/${id}`, data),

  deactivate: (id: string) =>
    api.delete<{ data: { message: string } }>(`/players/${id}`),

  reactivate: (id: string) =>
    api.post<PlayerResponse>(`/players/${id}/reactivate`),
};
