import { api } from '@/lib/api';

/**
 * Opposition Notes API service.
 */

export interface OppositionNote {
  id: string;
  opponent: string;
  fixtureId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOppositionNoteInput {
  opponent: string;
  fixtureId?: string;
  notes: string;
}

interface OppositionNotesResponse {
  data: OppositionNote[];
}

interface CreateOppositionNoteResponse {
  data: OppositionNote;
}

export const oppositionNotesApi = {
  getByOpponent: (opponent: string) =>
    api.get<OppositionNotesResponse>(`/opposition-notes?opponent=${encodeURIComponent(opponent)}`),

  create: (data: CreateOppositionNoteInput) =>
    api.post<CreateOppositionNoteResponse>('/opposition-notes', data),
};
