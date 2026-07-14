import { useQuery, useMutation } from '@tanstack/react-query';
import { aiCoachApi, type ChatMessage } from '@/services/ai-coach.service';

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => aiCoachApi.getStatus(),
    select: (r) => r.data,
  });
}

export function useAiChat() {
  return useMutation({
    mutationFn: ({ message, history }: { message: string; history?: ChatMessage[] }) =>
      aiCoachApi.chat(message, history),
  });
}

export function useAiTrainingPlan() {
  return useMutation({
    mutationFn: ({ theme, durationMinutes }: { theme: string; durationMinutes?: number }) =>
      aiCoachApi.generateTrainingPlan(theme, durationMinutes),
  });
}
