import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/services/statistics.service';

const STATS_KEY = ['statistics'] as const;

export function usePlayerStats() {
  return useQuery({
    queryKey: [...STATS_KEY, 'players'],
    queryFn: () => statsApi.getPlayerStats(),
    select: (r) => r.data,
  });
}

export function useTeamStats() {
  return useQuery({
    queryKey: [...STATS_KEY, 'team'],
    queryFn: () => statsApi.getTeamStats(),
    select: (r) => r.data,
  });
}

export function useMatchResults() {
  return useQuery({
    queryKey: [...STATS_KEY, 'results'],
    queryFn: () => statsApi.getResults(),
    select: (r) => r.data,
  });
}
