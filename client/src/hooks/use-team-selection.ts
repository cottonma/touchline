import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamSelectionApi, type GkAssignment, type SubstitutionPlan, type EngineConfig, type PlayerForSelection } from '@/services/team-selection.service';

/**
 * React Query hooks for team selection.
 */

const TEAM_SELECTION_KEY = ['team-selection'] as const;

/** Generate a team selection plan */
export function useGenerateTeamSelection() {
  return useMutation({
    mutationFn: ({ fixtureId, gkAssignments }: { fixtureId: string; gkAssignments?: GkAssignment[] }) =>
      teamSelectionApi.generate(fixtureId, gkAssignments),
  });
}

/** Approve the current plan */
export function useApproveTeamSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fixtureId, plan, config, availablePlayers, generatedBy }: {
      fixtureId: string;
      plan: SubstitutionPlan;
      config: EngineConfig;
      availablePlayers: PlayerForSelection[];
      generatedBy: 'engine' | 'coach';
    }) =>
      teamSelectionApi.approve(fixtureId, { plan, config, availablePlayers, generatedBy }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...TEAM_SELECTION_KEY, variables.fixtureId] });
    },
  });
}

/** Get approved plan for a fixture */
export function useApprovedPlan(fixtureId: string | undefined) {
  return useQuery({
    queryKey: [...TEAM_SELECTION_KEY, fixtureId],
    queryFn: () => teamSelectionApi.getApproved(fixtureId!),
    select: (response) => response.data,
    enabled: !!fixtureId,
  });
}

/** Regenerate plan with excluded players */
export function useRegenerateTeamSelection() {
  return useMutation({
    mutationFn: ({ fixtureId, excludePlayerIds, gkAssignments }: {
      fixtureId: string;
      excludePlayerIds: string[];
      gkAssignments?: GkAssignment[];
    }) =>
      teamSelectionApi.regenerate(fixtureId, excludePlayerIds, gkAssignments),
  });
}
