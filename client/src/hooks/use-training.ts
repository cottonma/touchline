import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, type TrainingBlock } from '@/services/training.service';

const TRAINING_KEY = ['training'] as const;

export function useTrainingSessions() {
  return useQuery({
    queryKey: TRAINING_KEY,
    queryFn: () => trainingApi.getAll(),
    select: (r) => r.data,
  });
}

export function useTrainingSession(id: string | undefined) {
  return useQuery({
    queryKey: [...TRAINING_KEY, id],
    queryFn: () => trainingApi.getById(id!),
    select: (r) => r.data,
    enabled: !!id,
  });
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { theme?: string; objectives?: string[]; plan?: TrainingBlock[]; notes?: string }) =>
      trainingApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: TRAINING_KEY }); },
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { theme?: string; objectives?: string[]; plan?: TrainingBlock[]; notes?: string } }) =>
      trainingApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: TRAINING_KEY }); },
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: TRAINING_KEY }); },
  });
}
