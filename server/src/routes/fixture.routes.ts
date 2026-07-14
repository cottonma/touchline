import { Router } from 'express';
import { fixtureController } from '../controllers/fixture.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Fixture API Routes
 *
 * GET    /api/fixtures          - List fixtures (query: seasonId, type, status)
 * GET    /api/fixtures/next     - Get next upcoming fixture
 * GET    /api/fixtures/:id      - Get fixture by ID
 * POST   /api/fixtures          - Create a new fixture
 * PUT    /api/fixtures/:id      - Update a fixture
 * POST   /api/fixtures/:id/cancel - Cancel a fixture
 * DELETE /api/fixtures/:id      - Delete a fixture permanently
 */

const router = Router();

router.get('/next', asyncHandler((req, res) => fixtureController.getNext(req, res)));
router.get('/', asyncHandler((req, res) => fixtureController.getAll(req, res)));
router.get('/:id', asyncHandler((req, res) => fixtureController.getById(req, res)));
router.post('/', asyncHandler((req, res) => fixtureController.create(req, res)));
router.put('/:id', asyncHandler((req, res) => fixtureController.update(req, res)));
router.post('/:id/cancel', asyncHandler((req, res) => fixtureController.cancel(req, res)));
router.delete('/:id', asyncHandler((req, res) => fixtureController.delete(req, res)));

export const fixtureRoutes = router;
