import { api } from '@/lib/api';

export interface DevelopmentGoal {
  id: string;
  playerId: string;
  seasonId: string | null;
  category: string;
  positionGroup: string;
  title: string;
  description: string | null;
  status: 'working_on_it' | 'improving' | 'achieved';
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentObservation {
  id: string;
  goalId: string | null;
  playerId: string;
  fixtureId: string | null;
  observation: string;
  observedAt: string;
  createdAt: string;
}

export interface GoalLibraryItem {
  id: string;
  category: string;
  positionGroup: string;
  title: string;
  description: string | null;
  isCustom: boolean;
}

export const developmentApi = {
  getPlayerGoals: (playerId: string) =>
    api.get<{ data: { goals: DevelopmentGoal[]; observations: DevelopmentObservation[] } }>(`/development/players/${playerId}`),

  createGoal: (playerId: string, data: { category: string; positionGroup: string; title: string; description?: string }) =>
    api.post<{ data: DevelopmentGoal }>(`/development/players/${playerId}/goals`, data),

  updateGoalStatus: (goalId: string, status: string) =>
    api.put<{ data: DevelopmentGoal }>(`/development/goals/${goalId}/status`, { status }),

  deleteGoal: (goalId: string) =>
    api.delete<{ data: { message: string } }>(`/development/goals/${goalId}`),

  addObservation: (playerId: string, data: { observation: string; goalId?: string; observedAt?: string }) =>
    api.post<{ data: DevelopmentObservation }>(`/development/players/${playerId}/observations`, data),

  getLibrary: (positionGroup?: string, category?: string) => {
    const params = new URLSearchParams();
    if (positionGroup) params.set('positionGroup', positionGroup);
    if (category) params.set('category', category);
    const qs = params.toString();
    return api.get<{ data: GoalLibraryItem[]; count: number }>(`/development/library${qs ? `?${qs}` : ''}`);
  },

  seedLibrary: () => api.post<{ data: GoalLibraryItem[]; count: number }>('/development/library/seed'),
};
