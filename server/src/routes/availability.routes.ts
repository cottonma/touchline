import { Router } from 'express';
import { availabilityController } from '../controllers/availability.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Availability API Routes
 * Nested under /api/fixtures/:fixtureId/availability
 *
 * GET    /api/fixtures/:fixtureId/availability       - Get availability for all players
 * PUT    /api/fixtures/:fixtureId/availability       - Update single player availability
 * POST   /api/fixtures/:fixtureId/availability/batch - Batch update multiple players
 */

const router = Router({ mergeParams: true });

router.get('/', asyncHandler((req, res) => availabilityController.getByFixture(req, res)));
router.put('/', asyncHandler((req, res) => availabilityController.update(req, res)));
router.post('/batch', asyncHandler((req, res) => availabilityController.batchUpdate(req, res)));

export const availabilityRoutes = router;
