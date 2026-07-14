import { api } from '@/lib/api';

export interface TrainingBlock {
  type: string;
  title: string;
  duration: number;
  description?: string;
  equipment?: string;
  coachingPoints?: string;
}

export interface TrainingSession {
  id: string;
  fixtureId: string | null;
  theme: string | null;
  objectives: string | null;
  plan: string | null;
  notes: string | null;
  linkedFixtureId: string | null;
  parsedObjectives: string[];
  parsedPlan: TrainingBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainingAttendance {
  id: string;
  fixtureId: string;
  playerId: string;
  attended: boolean;
  reason: string | null;
}

export const trainingApi = {
  getAll: () => api.get<{ data: TrainingSession[]; count: number }>('/training'),
  getById: (id: string) => api.get<{ data: TrainingSession }>(`/training/${id}`),
  create: (data: { fixtureId?: string; theme?: string; objectives?: string[]; plan?: TrainingBlock[]; notes?: string; linkedFixtureId?: string }) =>
    api.post<{ data: TrainingSession }>('/training', data),
  update: (id: string, data: { theme?: string; objectives?: string[]; plan?: TrainingBlock[]; notes?: string; linkedFixtureId?: string }) =>
    api.put<{ data: TrainingSession }>(`/training/${id}`, data),
  delete: (id: string) => api.delete<{ data: { message: string } }>(`/training/${id}`),

  getAttendance: (fixtureId: string) => api.get<{ data: TrainingAttendance[] }>(`/training/attendance/${fixtureId}`),
  recordAttendance: (fixtureId: string, items: { playerId: string; attended: boolean; reason?: string }[]) =>
    api.post<{ data: TrainingAttendance[]; count: number }>(`/training/attendance/${fixtureId}`, { items }),
};
