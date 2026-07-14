import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policyApi } from '@/services/policy.service';

/**
 * React Query hooks for coaching policies.
 */

const POLICIES_KEY = ['policies'] as const;

/** Fetch all policies grouped by category */
export function usePolicies() {
  return useQuery({
    queryKey: POLICIES_KEY,
    queryFn: () => policyApi.getAll(),
    select: (response) => response.data,
  });
}

/** Fetch policies for a specific category */
export function usePoliciesByCategory(category: string) {
  return useQuery({
    queryKey: [...POLICIES_KEY, category],
    queryFn: () => policyApi.getByCategory(category),
    select: (response) => response.data,
  });
}

/** Update a single policy value */
export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      category,
      key,
      value,
      description,
    }: {
      category: string;
      key: string;
      value: unknown;
      description?: string;
    }) => policyApi.update(category, key, value, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLICIES_KEY });
    },
  });
}

/** Seed default policies */
export function useSeedPolicies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => policyApi.seed(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLICIES_KEY });
    },
  });
}
