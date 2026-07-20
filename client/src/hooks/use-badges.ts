import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Badge {
  id: string;
  playerId: string;
  badgeType: string;
  title: string;
  emoji: string;
  description: string | null;
  awardedBy: string | null;
  fixtureId: string | null;
  createdAt: string;
}

interface BadgeTemplate {
  type: string;
  title: string;
  emoji: string;
  description: string;
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
    mutationFn: (data: { playerId: string; badgeType: string; title: string; emoji: string; description?: string }) =>
      api.post('/badges/award', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['badges', variables.playerId] });
    },
  });
}
