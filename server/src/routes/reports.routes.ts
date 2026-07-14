import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Reports API Routes
 *
 * GET /api/reports/playing-time       - Season playing time summary
 * GET /api/reports/attendance         - Attendance report (matches + training)
 * GET /api/reports/player/:playerId   - Individual player report card
 * GET /api/reports/season-results     - Season results (W/D/L, goals)
 * GET /api/reports/gk-rotation        - GK rotation report
 * GET /api/reports/development        - Development progress report
 */

const router = Router();

router.get('/playing-time', asyncHandler((req, res) => reportsController.getPlayingTime(req, res)));
router.get('/attendance', asyncHandler((req, res) => reportsController.getAttendance(req, res)));
router.get('/player/:playerId', asyncHandler((req, res) => reportsController.getPlayerReport(req, res)));
router.get('/season-results', asyncHandler((req, res) => reportsController.getSeasonResults(req, res)));
router.get('/gk-rotation', asyncHandler((req, res) => reportsController.getGkRotation(req, res)));
router.get('/development', asyncHandler((req, res) => reportsController.getDevelopmentProgress(req, res)));

export const reportsRoutes = router;
