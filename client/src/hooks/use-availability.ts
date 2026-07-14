import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { availabilityApi } from '@/services/availability.service';

/**
 * React Query hooks for availability tracking.
 */

const AVAILABILITY_KEY = ['availability'] as const;

/** Fetch availability for a fixture (includes all players with status) */
export function useFixtureAvailability(fixtureId: string | undefined) {
  return useQuery({
    queryKey: [...AVAILABILITY_KEY, fixtureId],
    queryFn: () => availabilityApi.getByFixture(fixtureId!),
    enabled: !!fixtureId,
  });
}

/** Update a single player's availability */
export function useUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fixtureId,
      playerId,
      status,
      reason,
    }: {
      fixtureId: string;
      playerId: string;
      status: string;
      reason?: string;
    }) => availabilityApi.update(fixtureId, playerId, status, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...AVAILABILITY_KEY, variables.fixtureId] });
    },
  });
}

/** Batch update availability for multiple players */
export function useBatchUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fixtureId,
      items,
    }: {
      fixtureId: string;
      items: { playerId: string; status: string; reason?: string }[];
    }) => availabilityApi.batchUpdate(fixtureId, items),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...AVAILABILITY_KEY, variables.fixtureId] });
    },
  });
}
