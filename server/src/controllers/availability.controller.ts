import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { availabilityService } from '../services/availability.service.js';
import { updateAvailabilitySchema, batchUpdateAvailabilitySchema } from '../validation/availability.validation.js';

type Request = ExpressRequest<{ fixtureId?: string }>;

/**
 * Availability Controller - Handles HTTP requests for availability tracking.
 */

export class AvailabilityController {
  /**
   * GET /api/fixtures/:fixtureId/availability
   * Get availability for all players for a fixture.
   */
  async getByFixture(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const result = await availabilityService.getFixtureAvailability(fixtureId);

    if (!result.success) {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }

    // Also get summary counts
    const summary = await availabilityService.getAvailabilitySummary(fixtureId);

    res.json({ data: result.data, summary });
  }

  /**
   * PUT /api/fixtures/:fixtureId/availability
   * Update availability for a single player.
   */
  async update(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;

    const parsed = updateAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid availability data.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await availabilityService.updateAvailability({
      fixtureId,
      playerId: parsed.data.playerId,
      status: parsed.data.status,
      reason: parsed.data.reason,
    });

    if (!result.success) {
      const statusCode = result.error.code.includes('NOT_FOUND') ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/fixtures/:fixtureId/availability/batch
   * Batch update availability for multiple players at once.
   */
  async batchUpdate(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;

    const parsed = batchUpdateAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid availability data.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await availabilityService.batchUpdateAvailability(fixtureId, parsed.data.items);

    if (!result.success) {
      const statusCode = result.error.code.includes('NOT_FOUND') ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data, count: result.data.length });
  }
}

// Singleton instance
export const availabilityController = new AvailabilityController();
