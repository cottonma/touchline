import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixtureApi, type CreateFixtureInput, type UpdateFixtureInput } from '@/services/fixture.service';

/**
 * React Query hooks for fixture management.
 */

const FIXTURES_KEY = ['fixtures'] as const;

/** Fetch all fixtures with optional filters */
export function useFixtures(params?: { seasonId?: string; type?: string; status?: string }) {
  return useQuery({
    queryKey: [...FIXTURES_KEY, params],
    queryFn: () => fixtureApi.getAll(params),
    select: (response) => response.data,
  });
}

/** Fetch the next upcoming fixture */
export function useNextFixture(seasonId?: string) {
  return useQuery({
    queryKey: [...FIXTURES_KEY, 'next', seasonId],
    queryFn: () => fixtureApi.getNext(seasonId),
    select: (response) => response.data,
  });
}

/** Fetch a single fixture by ID */
export function useFixture(id: string | undefined) {
  return useQuery({
    queryKey: [...FIXTURES_KEY, id],
    queryFn: () => fixtureApi.getById(id!),
    select: (response) => response.data,
    enabled: !!id,
  });
}

/** Create a new fixture */
export function useCreateFixture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFixtureInput) => fixtureApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    },
  });
}

/** Update a fixture */
export function useUpdateFixture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFixtureInput }) =>
      fixtureApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    },
  });
}

/** Cancel a fixture */
export function useCancelFixture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fixtureApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    },
  });
}

/** Delete a fixture */
export function useDeleteFixture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fixtureApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    },
  });
}
