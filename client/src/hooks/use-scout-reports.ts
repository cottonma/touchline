import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scoutReportApi, type CreateScoutReportInput, type UpdateScoutReportInput } from '@/services/scout-report.service';

/**
 * React Query hooks for scout report management.
 */

const SCOUT_REPORTS_KEY = ['scout-reports'] as const;

/** Fetch all scout reports with optional filters */
export function useScoutReports(params?: { opponent?: string; fixtureId?: string }) {
  return useQuery({
    queryKey: [...SCOUT_REPORTS_KEY, params],
    queryFn: () => scoutReportApi.getAll(params),
    select: (response) => response.data,
  });
}

/** Fetch a single scout report by ID */
export function useScoutReport(id: string | undefined) {
  return useQuery({
    queryKey: [...SCOUT_REPORTS_KEY, id],
    queryFn: () => scoutReportApi.getById(id!),
    select: (response) => response.data,
    enabled: !!id,
  });
}

/** Create a new scout report */
export function useCreateScoutReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateScoutReportInput) => scoutReportApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCOUT_REPORTS_KEY });
    },
  });
}

/** Update a scout report */
export function useUpdateScoutReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateScoutReportInput }) =>
      scoutReportApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCOUT_REPORTS_KEY });
    },
  });
}

/** Delete a scout report */
export function useDeleteScoutReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => scoutReportApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCOUT_REPORTS_KEY });
    },
  });
}
