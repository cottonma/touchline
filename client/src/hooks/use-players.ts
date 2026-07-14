import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playerApi, type CreatePlayerInput, type UpdatePlayerInput } from '@/services/player.service';

/**
 * React Query hooks for player management.
 * Provides data fetching, caching, and mutation with automatic cache invalidation.
 */

const PLAYERS_KEY = ['players'] as const;

/** Fetch all active players */
export function usePlayers(includeInactive = false) {
  return useQuery({
    queryKey: [...PLAYERS_KEY, { includeInactive }],
    queryFn: () => playerApi.getAll(includeInactive),
    select: (response) => response.data,
  });
}

/** Fetch a single player by ID */
export function usePlayer(id: string | undefined) {
  return useQuery({
    queryKey: [...PLAYERS_KEY, id],
    queryFn: () => playerApi.getById(id!),
    select: (response) => response.data,
    enabled: !!id,
  });
}

/** Create a new player */
export function useCreatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlayerInput) => playerApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYERS_KEY });
    },
  });
}

/** Update a player */
export function useUpdatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlayerInput }) =>
      playerApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYERS_KEY });
    },
  });
}

/** Deactivate (soft delete) a player */
export function useDeactivatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => playerApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYERS_KEY });
    },
  });
}

/** Reactivate a player */
export function useReactivatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => playerApi.reactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYERS_KEY });
    },
  });
}
