import { Router } from 'express';
import { matchDayController } from '../controllers/match-day.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Match Day API Routes
 * Nested under /api/fixtures/:fixtureId/match-day
 *
 * GET  /api/fixtures/:fixtureId/match-day  - Get existing match record
 * POST /api/fixtures/:fixtureId/match-day  - Record/update match result
 */

const router = Router({ mergeParams: true });

router.get('/', asyncHandler((req, res) => matchDayController.get(req, res)));
router.post('/', asyncHandler((req, res) => matchDayController.record(req, res)));

export const matchDayRoutes = router;
