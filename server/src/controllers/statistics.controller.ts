import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { statisticsService } from '../services/statistics.service.js';

type Request = ExpressRequest<{ playerId?: string }>;

/**
 * Statistics Controller
 */

export class StatisticsController {
  /**
   * GET /api/stats/players
   * Get season stats for all players.
   */
  async getPlayerStats(req: Request, res: Response): Promise<void> {
    const seasonId = req.query.seasonId ? String(req.query.seasonId) : undefined;
    const stats = await statisticsService.getPlayerSeasonStats(seasonId);
    res.json({ data: stats });
  }

  /**
   * GET /api/stats/players/:playerId
   * Get season stats for a single player.
   */
  async getPlayerStatById(req: Request, res: Response): Promise<void> {
    const playerId = req.params.playerId!;
    const seasonId = req.query.seasonId ? String(req.query.seasonId) : undefined;
    const stats = await statisticsService.getPlayerStats(playerId, seasonId);

    if (!stats) {
      res.status(404).json({ error: 'PLAYER_NOT_FOUND', message: 'Player stats not found.' });
      return;
    }

    res.json({ data: stats });
  }

  /**
   * GET /api/stats/team
   * Get team season stats (W/D/L, goals, etc).
   */
  async getTeamStats(req: Request, res: Response): Promise<void> {
    const seasonId = req.query.seasonId ? String(req.query.seasonId) : undefined;
    const stats = await statisticsService.getTeamSeasonStats(seasonId);
    res.json({ data: stats });
  }

  /**
   * GET /api/stats/results
   * Get match-by-match results.
   */
  async getResults(req: Request, res: Response): Promise<void> {
    const seasonId = req.query.seasonId ? String(req.query.seasonId) : undefined;
    const results = await statisticsService.getMatchResults(seasonId);
    res.json({ data: results, count: results.length });
  }
}

// Singleton instance
export const statisticsController = new StatisticsController();
