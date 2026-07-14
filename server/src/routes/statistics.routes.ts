import { Router } from 'express';
import { statisticsController } from '../controllers/statistics.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Statistics API Routes
 *
 * GET /api/stats/players          - All player season stats
 * GET /api/stats/players/:playerId - Single player stats
 * GET /api/stats/team             - Team season stats
 * GET /api/stats/results          - Match-by-match results
 */

const router = Router();

router.get('/players', asyncHandler((req, res) => statisticsController.getPlayerStats(req, res)));
router.get('/players/:playerId', asyncHandler((req, res) => statisticsController.getPlayerStatById(req, res)));
router.get('/team', asyncHandler((req, res) => statisticsController.getTeamStats(req, res)));
router.get('/results', asyncHandler((req, res) => statisticsController.getResults(req, res)));

export const statisticsRoutes = router;
