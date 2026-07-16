import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { fixtureService } from '../services/fixture.service.js';
import { createFixtureSchema, updateFixtureSchema } from '../validation/fixture.validation.js';
import { getActiveSeasonId } from '../middleware/team-context.js';

type Request = ExpressRequest<{ id?: string }>;

/**
 * Fixture Controller - Handles HTTP requests for fixture management.
 */

export class FixtureController {
  /**
   * GET /api/fixtures
   * List fixtures. Query params: ?seasonId=, ?type=, ?status=upcoming|completed
   * If no seasonId query param, defaults to the active season for X-Club-Id header.
   */
  async getAll(req: Request, res: Response): Promise<void> {
    let seasonId = req.query.seasonId ? String(req.query.seasonId) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    // If no explicit seasonId, resolve from X-Club-Id header
    if (!seasonId) {
      seasonId = await getActiveSeasonId(req);
    }

    let data;
    if (status === 'upcoming') {
      data = await fixtureService.getUpcomingFixtures(seasonId);
    } else if (status === 'completed') {
      data = await fixtureService.getCompletedFixtures(seasonId);
    } else if (type) {
      data = await fixtureService.getFixturesByType(type, seasonId);
    } else {
      data = await fixtureService.getAllFixtures(seasonId);
    }

    res.json({ data, count: data.length });
  }

  /**
   * GET /api/fixtures/next
   * Get the next upcoming fixture.
   * If no seasonId query param, defaults to the active season for X-Club-Id header.
   */
  async getNext(req: Request, res: Response): Promise<void> {
    let seasonId = req.query.seasonId ? String(req.query.seasonId) : undefined;

    if (!seasonId) {
      seasonId = await getActiveSeasonId(req);
    }

    const fixture = await fixtureService.getNextFixture(seasonId);

    if (!fixture) {
      res.json({ data: null });
      return;
    }

    res.json({ data: fixture });
  }

  /**
   * GET /api/fixtures/:id
   * Get a single fixture by ID.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;
    const result = await fixtureService.getFixtureById(id);

    if (!result.success) {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/fixtures
   * Create a new fixture.
   */
  async create(req: Request, res: Response): Promise<void> {
    const parsed = createFixtureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid fixture data.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await fixtureService.createFixture(parsed.data);

    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.status(201).json({ data: result.data });
  }

  /**
   * PUT /api/fixtures/:id
   * Update an existing fixture.
   */
  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;

    const parsed = updateFixtureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid fixture data.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await fixtureService.updateFixture(id, parsed.data);

    if (!result.success) {
      const statusCode = result.error.code === 'FIXTURE_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/fixtures/:id/cancel
   * Cancel a fixture.
   */
  async cancel(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;
    const result = await fixtureService.cancelFixture(id);

    if (!result.success) {
      const statusCode = result.error.code === 'FIXTURE_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * DELETE /api/fixtures/:id
   * Delete a fixture permanently (only scheduled ones).
   */
  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;
    const result = await fixtureService.deleteFixture(id);

    if (!result.success) {
      const statusCode = result.error.code === 'FIXTURE_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }
}

// Singleton instance
export const fixtureController = new FixtureController();
