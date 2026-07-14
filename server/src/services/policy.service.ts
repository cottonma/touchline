import { policyRepository, type PolicyRow, type UpsertPolicyData } from '../repositories/policy.repository.js';

/**
 * Policy Service - Business logic for the Coaching Philosophy & Policy Engine.
 * 
 * Policies are grouped into 8 categories:
 * 1. philosophy - Overall coaching approach (development/balanced/competitive)
 * 2. playing_time - Equal time rules, tolerance, minimum play constraints
 * 3. positions - Position rotation frequency and preferences
 * 4. goalkeeper - GK rotation rules and volunteer management
 * 5. match_objective - Default match objective
 * 6. statistics - Which stats are visible and to whom
 * 7. recognition - Milestones and gamification settings
 * 8. ai_behaviour - AI tone, features enabled/disabled
 */

export interface PolicyServiceError {
  code: string;
  message: string;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: PolicyServiceError };

/** Default policies - seeded on first run */
export const DEFAULT_POLICIES: UpsertPolicyData[] = [
  // Philosophy
  {
    category: 'philosophy',
    key: 'coaching_philosophy',
    value: JSON.stringify('development'),
    description: 'Overall coaching approach: development, balanced, or competitive',
  },

  // Playing Time
  {
    category: 'playing_time',
    key: 'equal_time_per_match',
    value: JSON.stringify(true),
    description: 'Whether to enforce equal playing time within each match',
  },
  {
    category: 'playing_time',
    key: 'tolerance_minutes',
    value: JSON.stringify(2),
    description: 'Maximum allowed difference in minutes between any two outfield players',
  },
  {
    category: 'playing_time',
    key: 'max_consecutive_bench_periods',
    value: JSON.stringify(1),
    description: 'Maximum consecutive periods a player can sit out (1 = must play every other period)',
  },
  {
    category: 'playing_time',
    key: 'cross_match_compensation',
    value: JSON.stringify(false),
    description: 'Whether to compensate missed matches with extra time in subsequent matches',
  },
  {
    category: 'playing_time',
    key: 'min_sub_minutes',
    value: JSON.stringify(5),
    description: 'Minimum minutes a player must get when subbed on or off mid-period',
  },
  {
    category: 'playing_time',
    key: 'min_sub_minutes',
    value: JSON.stringify(5),
    description: 'Minimum minutes a player must get when subbed on or off mid-period',
  },
  {
    category: 'playing_time',
    key: 'min_sub_minutes',
    value: JSON.stringify(5),
    description: 'Minimum minutes a player must play when subbed on mid-period',
  },

  // Position Rotation
  {
    category: 'positions',
    key: 'rotation_enabled',
    value: JSON.stringify(true),
    description: 'Whether the system suggests position rotation',
  },
  {
    category: 'positions',
    key: 'rotation_frequency_weeks',
    value: JSON.stringify(6),
    description: 'Number of weeks a player stays in primary position before rotation is suggested',
  },
  {
    category: 'positions',
    key: 'primary_position_priority',
    value: JSON.stringify(true),
    description: 'Whether to prioritise primary position in team selection',
  },

  // Goalkeeper
  {
    category: 'goalkeeper',
    key: 'rotation_enabled',
    value: JSON.stringify(true),
    description: 'Whether to rotate GK duty across volunteers',
  },
  {
    category: 'goalkeeper',
    key: 'suggest_next_gk',
    value: JSON.stringify(true),
    description: 'Whether the system suggests who should play GK next based on rotation history',
  },
  {
    category: 'goalkeeper',
    key: 'gk_reward_full_outfield',
    value: JSON.stringify(true),
    description: 'GK plays full outfield time in non-GK periods (Option A)',
  },
  {
    category: 'goalkeeper',
    key: 'max_gk_periods_per_match',
    value: JSON.stringify(2),
    description: 'Maximum periods a single player can be in goal per match',
  },

  // Match Objective (defaults)
  {
    category: 'match_objective',
    key: 'default_objective',
    value: JSON.stringify('balanced'),
    description: 'Default match objective when not set per fixture',
  },

  // Statistics
  {
    category: 'statistics',
    key: 'show_leaderboards',
    value: JSON.stringify(true),
    description: 'Whether to show stat leaderboards (coach-only in MVP)',
  },
  {
    category: 'statistics',
    key: 'track_clean_sheets',
    value: JSON.stringify(true),
    description: 'Track clean sheets for GKs and defenders',
  },
  {
    category: 'statistics',
    key: 'clean_sheet_min_periods',
    value: JSON.stringify(2),
    description: 'Minimum periods a defender must play to qualify for a clean sheet',
  },

  // Recognition
  {
    category: 'recognition',
    key: 'milestones_enabled',
    value: JSON.stringify(true),
    description: 'Whether to track and display player milestones',
  },
  {
    category: 'recognition',
    key: 'milestone_appearances',
    value: JSON.stringify([10, 25, 50]),
    description: 'Appearance milestones to celebrate',
  },

  // AI Behaviour
  {
    category: 'ai_behaviour',
    key: 'enabled',
    value: JSON.stringify(true),
    description: 'Whether AI features are enabled',
  },
  {
    category: 'ai_behaviour',
    key: 'tone',
    value: JSON.stringify('brief'),
    description: 'AI response tone: brief or detailed',
  },
  {
    category: 'ai_behaviour',
    key: 'philosophy_aware',
    value: JSON.stringify(true),
    description: 'Whether AI aligns suggestions with coaching philosophy',
  },
  {
    category: 'ai_behaviour',
    key: 'suggest_formation_changes',
    value: JSON.stringify(true),
    description: 'Whether AI can suggest formation/positional changes',
  },
  {
    category: 'ai_behaviour',
    key: 'explain_reasoning',
    value: JSON.stringify(true),
    description: 'Whether AI explains its reasoning in suggestions',
  },
];

export class PolicyService {
  /**
   * Get all policies, grouped by category.
   */
  async getAllPolicies(): Promise<Record<string, PolicyRow[]>> {
    const all = await policyRepository.findAll();
    const grouped: Record<string, PolicyRow[]> = {};
    for (const policy of all) {
      if (!grouped[policy.category]) {
        grouped[policy.category] = [];
      }
      grouped[policy.category].push(policy);
    }
    return grouped;
  }

  /**
   * Get policies for a specific category.
   */
  async getPoliciesByCategory(category: string): Promise<ServiceResult<PolicyRow[]>> {
    const validCategories = [
      'philosophy', 'playing_time', 'positions', 'goalkeeper',
      'match_objective', 'statistics', 'recognition', 'ai_behaviour',
    ];

    if (!validCategories.includes(category)) {
      return {
        success: false,
        error: { code: 'INVALID_CATEGORY', message: `Invalid policy category: ${category}` },
      };
    }

    const policies = await policyRepository.findByCategory(category);
    return { success: true, data: policies };
  }

  /**
   * Update a policy value.
   */
  async updatePolicy(category: string, key: string, value: unknown, description?: string): Promise<ServiceResult<PolicyRow>> {
    const serializedValue = JSON.stringify(value);

    const policy = await policyRepository.upsert({
      category,
      key,
      value: serializedValue,
      description,
    });

    return { success: true, data: policy };
  }

  /**
   * Batch update policies.
   */
  async batchUpdatePolicies(
    items: { category: string; key: string; value: unknown; description?: string }[]
  ): Promise<ServiceResult<PolicyRow[]>> {
    const upsertData: UpsertPolicyData[] = items.map((item) => ({
      category: item.category,
      key: item.key,
      value: JSON.stringify(item.value),
      description: item.description,
    }));

    const results = await policyRepository.batchUpsert(upsertData);
    return { success: true, data: results };
  }

  /**
   * Seed default policies on first run.
   * Only creates policies that don't already exist.
   */
  async seedDefaults(): Promise<void> {
    await policyRepository.seedDefaults(DEFAULT_POLICIES);
  }

  /**
   * Get a specific policy value, typed and parsed.
   */
  async getPolicyValue<T>(category: string, key: string, defaultValue: T): Promise<T> {
    return policyRepository.getValue(category, key, defaultValue);
  }

  // === Convenience getters for engine use ===

  async getCoachingPhilosophy(): Promise<string> {
    return this.getPolicyValue('philosophy', 'coaching_philosophy', 'development');
  }

  async getPlayingTimeConfig() {
    return {
      equalTimePerMatch: await this.getPolicyValue('playing_time', 'equal_time_per_match', true),
      toleranceMinutes: await this.getPolicyValue('playing_time', 'tolerance_minutes', 2),
      maxConsecutiveBenchPeriods: await this.getPolicyValue('playing_time', 'max_consecutive_bench_periods', 1),
      crossMatchCompensation: await this.getPolicyValue('playing_time', 'cross_match_compensation', false),
      minSubMinutes: await this.getPolicyValue('playing_time', 'min_sub_minutes', 5),
    };
  }

  async getPositionConfig() {
    return {
      rotationEnabled: await this.getPolicyValue('positions', 'rotation_enabled', true),
      rotationFrequencyWeeks: await this.getPolicyValue('positions', 'rotation_frequency_weeks', 6),
      primaryPositionPriority: await this.getPolicyValue('positions', 'primary_position_priority', true),
    };
  }

  async getGoalkeeperConfig() {
    return {
      rotationEnabled: await this.getPolicyValue('goalkeeper', 'rotation_enabled', true),
      suggestNextGk: await this.getPolicyValue('goalkeeper', 'suggest_next_gk', true),
      gkRewardFullOutfield: await this.getPolicyValue('goalkeeper', 'gk_reward_full_outfield', true),
      maxGkPeriodsPerMatch: await this.getPolicyValue('goalkeeper', 'max_gk_periods_per_match', 2),
    };
  }

  async getAiBehaviourConfig() {
    return {
      enabled: await this.getPolicyValue('ai_behaviour', 'enabled', true),
      tone: await this.getPolicyValue('ai_behaviour', 'tone', 'brief'),
      philosophyAware: await this.getPolicyValue('ai_behaviour', 'philosophy_aware', true),
      suggestFormationChanges: await this.getPolicyValue('ai_behaviour', 'suggest_formation_changes', true),
      explainReasoning: await this.getPolicyValue('ai_behaviour', 'explain_reasoning', true),
    };
  }
}

// Singleton instance
export const policyService = new PolicyService();
