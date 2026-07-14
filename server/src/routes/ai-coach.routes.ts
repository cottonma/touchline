import { Router } from 'express';
import { aiCoachController } from '../controllers/ai-coach.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * AI Coach API Routes
 *
 * GET  /api/ai/status         - Check AI availability
 * POST /api/ai/chat           - Chat with AI Coach
 * POST /api/ai/training-plan  - Generate training plan
 */

const router = Router();

router.get('/status', asyncHandler((req, res) => aiCoachController.getStatus(req, res)));
router.post('/chat', asyncHandler((req, res) => aiCoachController.chat(req, res)));
router.post('/training-plan', asyncHandler((req, res) => aiCoachController.generateTrainingPlan(req, res)));

export const aiCoachRoutes = router;
