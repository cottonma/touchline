import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { matchDayService } from '../services/match-day.service.js';

type Request = ExpressRequest<{ fixtureId?: string }>;

/**
 * Match Day Controller - post-match recording.
 */

export class MatchDayController {
  /**
   * GET /api/fixtures/:fixtureId/match-day
   * Get existing match day record (if already recorded).
   */
  async get(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const result = await matchDayService.getMatchDayRecord(fixtureId);

    if (!result.success) {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/fixtures/:fixtureId/match-day
   * Record (or update) a full match result.
   */
  async record(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const { goalsFor, goalsAgainst, coachNotes, motmPlayerId, goals, playingTime } = req.body;

    if (goalsFor === undefined || goalsAgainst === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'goalsFor and goalsAgainst are required.' });
      return;
    }

    if (!Array.isArray(playingTime) || playingTime.length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'playingTime array is required.' });
      return;
    }

    try {
      const result = await matchDayService.recordMatch({
        fixtureId,
        goalsFor,
        goalsAgainst,
        coachNotes,
        motmPlayerId,
        goals: goals || [],
        playingTime: playingTime.map((pt: { playerId: string; outfieldMinutes: number; goalkeeperMinutes: number; periodsPlayed: number; periodsInGoal: number }) => ({
          fixtureId,
          playerId: pt.playerId,
          outfieldMinutes: pt.outfieldMinutes,
          goalkeeperMinutes: pt.goalkeeperMinutes,
          totalMinutes: pt.outfieldMinutes + pt.goalkeeperMinutes,
          periodsPlayed: pt.periodsPlayed,
          periodsInGoal: pt.periodsInGoal,
        })),
      });

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
export const matchDayController = new MatchDayController();
