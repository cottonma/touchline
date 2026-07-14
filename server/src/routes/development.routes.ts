import { Router } from 'express';
import { developmentController } from '../controllers/development.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Development API Routes
 *
 * Player Goals:
 * GET    /api/development/players/:playerId       - Get goals + observations for a player
 * POST   /api/development/players/:playerId/goals - Create a goal for a player
 * PUT    /api/development/goals/:goalId/status    - Update goal status
 * DELETE /api/development/goals/:goalId           - Delete a goal
 *
 * Observations:
 * POST   /api/development/players/:playerId/observations         - Add general observation
 * POST   /api/development/goals/:goalId/observations             - Add observation to a goal
 *
 * Library:
 * GET    /api/development/library       - Get goal library (query: positionGroup, category)
 * POST   /api/development/library       - Add custom goal to library
 * POST   /api/development/library/seed  - Seed default library
 */

const router = Router();

// Player goals
router.get('/players/:playerId', asyncHandler((req, res) => developmentController.getPlayerGoals(req, res)));
router.post('/players/:playerId/goals', asyncHandler((req, res) => developmentController.createGoal(req, res)));

// Goal status and deletion
router.put('/goals/:goalId/status', asyncHandler((req, res) => developmentController.updateGoalStatus(req, res)));
router.delete('/goals/:goalId', asyncHandler((req, res) => developmentController.deleteGoal(req, res)));

// Observations
router.post('/players/:playerId/observations', asyncHandler((req, res) => developmentController.addObservation(req, res)));
router.post('/goals/:goalId/observations', asyncHandler((req, res) => developmentController.addObservation(req, res)));

// Library
router.get('/library', asyncHandler((req, res) => developmentController.getLibrary(req, res)));
router.post('/library', asyncHandler((req, res) => developmentController.addLibraryGoal(req, res)));
router.post('/library/seed', asyncHandler((req, res) => developmentController.seedLibrary(req, res)));

export const developmentRoutes = router;
