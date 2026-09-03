import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Badge {
  id: string;
  playerId: string;
  badgeType: string;
  title: string;
  emoji: string;
  description: string | null;
  tier: string;
  points: number;
  awardedBy: string | null;
  fixtureId: string | null;
  createdAt: string;
}

interface BadgeTemplate {
  type: string;
  title: string;
  emoji: string;
  description: string;
  tier: string;
  points: number;
}

export function usePlayerBadges(playerId: string | undefined) {
  return useQuery({
    queryKey: ['badges', playerId],
    queryFn: () => api.get<{ data: Badge[] }>(`/badges/player/${playerId}`),
    select: (res) => res.data,
    enabled: !!playerId,
  });
}

export function useBadgeTemplates() {
  return useQuery({
    queryKey: ['badge-templates'],
    queryFn: () => api.get<{ data: BadgeTemplate[] }>('/badges/templates'),
    select: (res) => res.data,
  });
}

export function useAwardBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { playerId: string; badgeType: string }) =>
      api.post('/badges/award', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['badges', variables.playerId] });
    },
  });
}

export function useDeleteBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { badgeId: string; playerId: string }) =>
      api.delete(`/badges/${data.badgeId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['badges', variables.playerId] });
    },
  });
}

export type { Badge, BadgeTemplate };
