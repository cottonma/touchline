/**
 * Policy types - configurable coaching policies that drive recommendations.
 */

import type { PolicyCategory } from './enums.js';

export interface Policy {
  id: string;
  category: PolicyCategory;
  key: string;
  value: string; // JSON stringified
  description: string | null;
  updatedAt: string;
}

export interface UpdatePolicyInput {
  category: PolicyCategory;
  key: string;
  value: string;
  description?: string;
}
