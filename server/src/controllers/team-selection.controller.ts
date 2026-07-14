import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { teamSelectionService } from '../services/team-selection.service.js';
import type { GkAssignment } from '../engines/playing-time.engine.js';

type Request = ExpressRequest<{ fixtureId?: string }>;

/**
 * Team Selection Controller
 */

export class TeamSelectionController {
  /**
   * POST /api/fixtures/:fixtureId/team-selection/generate
   * Generate a team selection and substitution plan.
   * Optional body: { gkAssignments: [{ playerId, periods: [1,2] }] }
   */
  async generate(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const gkAssignments: GkAssignment[] | undefined = req.body?.gkAssignments;

    try {
      const result = await teamSelectionService.generateTeamSelection(fixtureId, gkAssignments);

      if (!result.success) {
        const statusCode = result.error.code.includes('NOT_FOUND') ? 404 : 400;
        res.status(statusCode).json({ error: result.error.code, message: result.error.message });
        return;
      }

      res.json({ data: result.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * POST /api/fixtures/:fixtureId/team-selection/approve
   * Approve/save the finalized substitution plan.
   * Body: { plan, config, availablePlayers, generatedBy? }
   */
  async approve(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const { plan, config, availablePlayers, generatedBy } = req.body;

    if (!plan || !config) {
      res.status(400).json({ error: 'INVALID_BODY', message: 'plan and config are required.' });
      return;
    }

    try {
      const result = await teamSelectionService.approvePlan({
        fixtureId,
        plan,
        config,
        availablePlayers: availablePlayers ?? [],
        generatedBy: generatedBy ?? 'engine',
      });

      if (!result.success) {
        const statusCode = result.error.code.includes('NOT_FOUND') ? 404 : 400;
        res.status(statusCode).json({ error: result.error.code, message: result.error.message });
        return;
      }

      res.json({ data: result.data, message: 'Plan approved successfully.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * GET /api/fixtures/:fixtureId/team-selection
   * Get the approved substitution plan for a fixture.
   */
  async get(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;

    try {
      const result = await teamSelectionService.getApprovedPlan(fixtureId);

      if (!result.success) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve plan.' });
        return;
      }

      res.json({ data: result.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'INTERNAL_ERROR', message });
    }
  }

  /**
   * POST /api/fixtures/:fixtureId/team-selection/regenerate
   * Regenerate plan with excluded players (no-shows, injuries).
   * Body: { excludePlayerIds: string[], gkAssignments?: GkAssignment[] }
   */
  async regenerate(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const { excludePlayerIds, gkAssignments } = req.body;

    if (!excludePlayerIds || !Array.isArray(excludePlayerIds)) {
      res.status(400).json({ error: 'INVALID_BODY', message: 'excludePlayerIds array is required.' });
      return;
    }

    try {
      const result = await teamSelectionService.regenerateWithExclusions(
        fixtureId,
        excludePlayerIds,
        gkAssignments,
      );

      if (!result.success) {
        const statusCode = result.error.code.includes('NOT_FOUND') ? 404 : 400;
        res.status(statusCode).json({ error: result.error.code, message: result.error.message });
        return;
      }

      res.json({ data: result.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'INTERNAL_ERROR', message });
    }
  }
}

// Singleton instance
export const teamSelectionController = new TeamSelectionController();
