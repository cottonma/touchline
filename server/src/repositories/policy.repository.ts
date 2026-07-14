import { db } from '../db/index.js';
import { policies } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Policy Repository - Data access layer for coaching policies.
 * Policies configure how recommendations are generated across the application.
 */

export interface PolicyRow {
  id: string;
  category: string;
  key: string;
  value: string; // JSON stringified
  description: string | null;
  updatedAt: string;
}

export interface UpsertPolicyData {
  category: string;
  key: string;
  value: string;
  description?: string;
}

export class PolicyRepository {
  /**
   * Get all policies.
   */
  async findAll(): Promise<PolicyRow[]> {
    return db.select().from(policies).orderBy(policies.category, policies.key);
  }

  /**
   * Get policies by category.
   */
  async findByCategory(category: string): Promise<PolicyRow[]> {
    return db
      .select()
      .from(policies)
      .where(eq(policies.category, category))
      .orderBy(policies.key);
  }

  /**
   * Get a specific policy by category and key.
   */
  async findByCategoryAndKey(category: string, key: string): Promise<PolicyRow | undefined> {
    const results = await db
      .select()
      .from(policies)
      .where(and(eq(policies.category, category), eq(policies.key, key)));
    return results[0];
  }

  /**
   * Upsert a policy - create or update based on category+key unique combination.
   */
  async upsert(data: UpsertPolicyData): Promise<PolicyRow> {
    const now = new Date().toISOString();
    const existing = await this.findByCategoryAndKey(data.category, data.key);

    if (existing) {
      const updated: PolicyRow = {
        ...existing,
        value: data.value,
        description: data.description ?? existing.description,
        updatedAt: now,
      };
      await db.update(policies).set(updated).where(eq(policies.id, existing.id));
      return updated;
    }

    const newPolicy: PolicyRow = {
      id: nanoid(),
      category: data.category,
      key: data.key,
      value: data.value,
      description: data.description ?? null,
      updatedAt: now,
    };

    await db.insert(policies).values(newPolicy);
    return newPolicy;
  }

  /**
   * Batch upsert policies.
   */
  async batchUpsert(items: UpsertPolicyData[]): Promise<PolicyRow[]> {
    const results: PolicyRow[] = [];
    for (const item of items) {
      const result = await this.upsert(item);
      results.push(result);
    }
    return results;
  }

  /**
   * Get the value of a specific policy, parsed from JSON.
   * Returns the default value if the policy doesn't exist.
   */
  async getValue<T>(category: string, key: string, defaultValue: T): Promise<T> {
    const policy = await this.findByCategoryAndKey(category, key);
    if (!policy) return defaultValue;
    try {
      return JSON.parse(policy.value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Seed default policies if they don't exist.
   */
  async seedDefaults(defaults: UpsertPolicyData[]): Promise<void> {
    for (const d of defaults) {
      const existing = await this.findByCategoryAndKey(d.category, d.key);
      if (!existing) {
        await this.upsert(d);
      }
    }
  }
}

// Singleton instance
export const policyRepository = new PolicyRepository();
