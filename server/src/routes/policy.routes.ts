import { Router } from 'express';
import { policyController } from '../controllers/policy.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Policy API Routes
 *
 * GET    /api/policies           - Get all policies grouped by category
 * GET    /api/policies/:category - Get policies for a category
 * PUT    /api/policies/:category - Update a single policy
 * POST   /api/policies/batch     - Batch update policies
 * POST   /api/policies/seed      - Seed default policies
 */

const router = Router();

router.get('/', asyncHandler((req, res) => policyController.getAll(req, res)));
router.post('/batch', asyncHandler((req, res) => policyController.batchUpdate(req, res)));
router.post('/seed', asyncHandler((req, res) => policyController.seed(req, res)));
router.get('/:category', asyncHandler((req, res) => policyController.getByCategory(req, res)));
router.put('/:category', asyncHandler((req, res) => policyController.update(req, res)));

export const policyRoutes = router;
