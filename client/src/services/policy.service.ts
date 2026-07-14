import { api } from '@/lib/api';

/**
 * Policy API service.
 */

export interface Policy {
  id: string;
  category: string;
  key: string;
  value: string; // JSON stringified
  description: string | null;
  updatedAt: string;
}

export type GroupedPolicies = Record<string, Policy[]>;

interface AllPoliciesResponse {
  data: GroupedPolicies;
}

interface CategoryPoliciesResponse {
  data: Policy[];
}

interface SinglePolicyResponse {
  data: Policy;
}

export const policyApi = {
  getAll: () => api.get<AllPoliciesResponse>('/policies'),

  getByCategory: (category: string) =>
    api.get<CategoryPoliciesResponse>(`/policies/${category}`),

  update: (category: string, key: string, value: unknown, description?: string) =>
    api.put<SinglePolicyResponse>(`/policies/${category}`, { key, value, description }),

  batchUpdate: (items: { category: string; key: string; value: unknown; description?: string }[]) =>
    api.post<{ data: Policy[]; count: number }>('/policies/batch', { items }),

  seed: () => api.post<AllPoliciesResponse>('/policies/seed'),
};

/** Parse a policy value from JSON string */
export function parsePolicyValue<T>(policy: Policy, defaultValue: T): T {
  try {
    return JSON.parse(policy.value) as T;
  } catch {
    return defaultValue;
  }
}
