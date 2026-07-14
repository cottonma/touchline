import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchDayApi, type RecordMatchInput } from '@/services/match-day.service';

/**
 * React Query hooks for match day recording.
 */

const MATCH_DAY_KEY = ['match-day'] as const;

/** Get existing match day record */
export function useMatchDayRecord(fixtureId: string | undefined) {
  return useQuery({
    queryKey: [...MATCH_DAY_KEY, fixtureId],
    queryFn: () => matchDayApi.get(fixtureId!),
    select: (response) => response.data,
    enabled: !!fixtureId,
  });
}

/** Record a match result */
export function useRecordMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fixtureId, data }: { fixtureId: string; data: RecordMatchInput }) =>
      matchDayApi.record(fixtureId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...MATCH_DAY_KEY, variables.fixtureId] });
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
    },
  });
}
