import { api } from '@/lib/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const aiCoachApi = {
  getStatus: () => api.get<{ data: { available: boolean } }>('/ai/status'),

  chat: (message: string, history?: ChatMessage[]) =>
    api.post<{ data: { reply: string } }>('/ai/chat', { message, history }),

  generateTrainingPlan: (theme: string, durationMinutes?: number) =>
    api.post<{ data: { plan: unknown[]; rawResponse: string } }>('/ai/training-plan', { theme, durationMinutes }),
};
