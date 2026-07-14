import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { policyService } from '../services/policy.service.js';

type Request = ExpressRequest<{ category?: string }>;

/**
 * Policy Controller - Handles HTTP requests for the Coaching Philosophy & Policy Engine.
 */

export class PolicyController {
  /**
   * GET /api/policies
   * Get all policies grouped by category.
   */
  async getAll(_req: Request, res: Response): Promise<void> {
    const grouped = await policyService.getAllPolicies();
    res.json({ data: grouped });
  }

  /**
   * GET /api/policies/:category
   * Get policies for a specific category.
   */
  async getByCategory(req: Request, res: Response): Promise<void> {
    const category = req.params.category!;
    const result = await policyService.getPoliciesByCategory(category);

    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * PUT /api/policies/:category
   * Update a single policy value.
   * Body: { key: string, value: any, description?: string }
   */
  async update(req: Request, res: Response): Promise<void> {
    const category = req.params.category!;
    const { key, value, description } = req.body;

    if (!key) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Policy key is required.' });
      return;
    }

    if (value === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Policy value is required.' });
      return;
    }

    const result = await policyService.updatePolicy(category, key, value, description);

    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/policies/batch
   * Batch update multiple policies at once.
   * Body: { items: [{ category, key, value, description? }] }
   */
  async batchUpdate(req: Request, res: Response): Promise<void> {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Items array is required.' });
      return;
    }

    const result = await policyService.batchUpdatePolicies(items);

    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data, count: result.data.length });
  }

  /**
   * POST /api/policies/seed
   * Seed default policies (only creates missing ones).
   */
  async seed(_req: Request, res: Response): Promise<void> {
    await policyService.seedDefaults();
    const grouped = await policyService.getAllPolicies();
    res.json({ data: grouped, message: 'Default policies seeded successfully.' });
  }
}

// Singleton instance
export const policyController = new PolicyController();
