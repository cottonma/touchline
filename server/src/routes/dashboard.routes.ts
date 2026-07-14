import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Dashboard API Routes
 *
 * GET /api/dashboard - Get all dashboard data in one call
 */

const router = Router();

router.get('/', asyncHandler((req, res) => dashboardController.getDashboard(req, res)));

export const dashboardRoutes = router;
