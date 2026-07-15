import { Router } from 'express';
import { trainingController } from '../controllers/training.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Training API Routes
 *
 * GET    /api/training              - List all sessions
 * GET    /api/training/:id          - Get session by ID
 * POST   /api/training              - Create a session
 * PUT    /api/training/:id          - Update a session
 * DELETE /api/training/:id          - Delete a session
 *
 * Session Attendance:
 * GET    /api/training/:id/attendance        - Get attendance for a training session
 * POST   /api/training/:id/attendance        - Toggle attendance for a player
 *
 * Legacy (fixture-based) Attendance:
 * GET    /api/training/attendance/:fixtureId        - Get attendance for a training fixture
 * POST   /api/training/attendance/:fixtureId        - Record attendance
 */

const router = Router();

// Legacy attendance routes (must be before /:id to avoid conflict)
router.get('/attendance/:fixtureId', asyncHandler((req, res) => trainingController.getAttendance(req, res)));
router.post('/attendance/:fixtureId', asyncHandler((req, res) => trainingController.recordAttendance(req, res)));

router.get('/', asyncHandler((req, res) => trainingController.getAll(req, res)));
router.get('/:id', asyncHandler((req, res) => trainingController.getById(req, res)));
router.post('/', asyncHandler((req, res) => trainingController.create(req, res)));
router.put('/:id', asyncHandler((req, res) => trainingController.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => trainingController.delete(req, res)));

// Session-based attendance
router.get('/:id/attendance', asyncHandler((req, res) => trainingController.getSessionAttendance(req, res)));
router.post('/:id/attendance', asyncHandler((req, res) => trainingController.toggleSessionAttendance(req, res)));

export const trainingRoutes = router;
