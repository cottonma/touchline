import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { developmentApi } from '@/services/development.service';

const DEV_KEY = ['development'] as const;

export function usePlayerDevelopment(playerId: string | undefined) {
  return useQuery({
    queryKey: [...DEV_KEY, 'player', playerId],
    queryFn: () => developmentApi.getPlayerGoals(playerId!),
    select: (r) => r.data,
    enabled: !!playerId,
  });
}

export function useGoalLibrary(positionGroup?: string, category?: string) {
  return useQuery({
    queryKey: [...DEV_KEY, 'library', positionGroup, category],
    queryFn: () => developmentApi.getLibrary(positionGroup, category),
    select: (r) => r.data,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, data }: { playerId: string; data: { category: string; positionGroup: string; title: string; description?: string } }) =>
      developmentApi.createGoal(playerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: DEV_KEY }); },
  });
}

export function useUpdateGoalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, status }: { goalId: string; status: string }) =>
      developmentApi.updateGoalStatus(goalId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: DEV_KEY }); },
  });
}

export function useAddObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, data }: { playerId: string; data: { observation: string; goalId?: string } }) =>
      developmentApi.addObservation(playerId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: DEV_KEY }); },
  });
}

export function useSeedLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => developmentApi.seedLibrary(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: DEV_KEY }); },
  });
}
