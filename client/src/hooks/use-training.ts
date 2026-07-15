import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, type TrainingBlock } from '@/services/training.service';

const TRAINING_KEY = ['training'] as const;
const ATTENDANCE_KEY = ['training-attendance'] as const;

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
    mutationFn: (data: { date?: string; theme?: string; objectives?: string[]; plan?: TrainingBlock[]; notes?: string }) =>
      trainingApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: TRAINING_KEY }); },
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { date?: string; theme?: string; objectives?: string[]; plan?: TrainingBlock[]; notes?: string } }) =>
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

// Session-based attendance hooks

export function useTrainingAttendance(sessionId: string | undefined) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, sessionId],
    queryFn: () => trainingApi.getSessionAttendance(sessionId!),
    select: (r) => r.data,
    enabled: !!sessionId,
  });
}

export function useToggleAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, playerId, attended }: { sessionId: string; playerId: string; attended: boolean }) =>
      trainingApi.toggleAttendance(sessionId, playerId, attended),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [...ATTENDANCE_KEY, variables.sessionId] });
    },
  });
}
