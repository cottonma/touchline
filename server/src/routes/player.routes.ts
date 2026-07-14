import { Router } from 'express';
import { playerController } from '../controllers/player.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Player API Routes
 * 
 * GET    /api/players          - List all players
 * GET    /api/players/:id      - Get player by ID
 * POST   /api/players          - Create a new player
 * PUT    /api/players/:id      - Update a player
 * DELETE /api/players/:id      - Deactivate a player (soft delete)
 * POST   /api/players/:id/reactivate - Reactivate a player
 */

const router = Router();

router.get('/', asyncHandler((req, res) => playerController.getAll(req, res)));
router.get('/:id', asyncHandler((req, res) => playerController.getById(req, res)));
router.post('/', asyncHandler((req, res) => playerController.create(req, res)));
router.put('/:id', asyncHandler((req, res) => playerController.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => playerController.deactivate(req, res)));
router.post('/:id/reactivate', asyncHandler((req, res) => playerController.reactivate(req, res)));

export const playerRoutes = router;
