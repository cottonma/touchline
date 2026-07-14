import { Router } from 'express';
import { teamSelectionController } from '../controllers/team-selection.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Team Selection API Routes
 * Nested under /api/fixtures/:fixtureId/team-selection
 *
 * GET  /api/fixtures/:fixtureId/team-selection             - Get approved plan
 * POST /api/fixtures/:fixtureId/team-selection/generate    - Generate substitution plan
 * POST /api/fixtures/:fixtureId/team-selection/approve     - Approve/save plan
 * POST /api/fixtures/:fixtureId/team-selection/regenerate  - Regenerate with exclusions
 */

const router = Router({ mergeParams: true });

router.get('/', asyncHandler((req, res) => teamSelectionController.get(req, res)));
router.post('/generate', asyncHandler((req, res) => teamSelectionController.generate(req, res)));
router.post('/approve', asyncHandler((req, res) => teamSelectionController.approve(req, res)));
router.post('/regenerate', asyncHandler((req, res) => teamSelectionController.regenerate(req, res)));

export const teamSelectionRoutes = router;
