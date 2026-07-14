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
 * Attendance:
 * GET    /api/training/attendance/:fixtureId        - Get attendance for a training fixture
 * POST   /api/training/attendance/:fixtureId        - Record attendance
 */

const router = Router();

router.get('/', asyncHandler((req, res) => trainingController.getAll(req, res)));
router.get('/:id', asyncHandler((req, res) => trainingController.getById(req, res)));
router.post('/', asyncHandler((req, res) => trainingController.create(req, res)));
router.put('/:id', asyncHandler((req, res) => trainingController.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => trainingController.delete(req, res)));

// Attendance
router.get('/attendance/:fixtureId', asyncHandler((req, res) => trainingController.getAttendance(req, res)));
router.post('/attendance/:fixtureId', asyncHandler((req, res) => trainingController.recordAttendance(req, res)));

export const trainingRoutes = router;
