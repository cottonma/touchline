import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { matchPlanService } from '../services/match-plan.service.js';
import { getClubId } from '../middleware/team-context.js';

/**
 * Match Plan API Routes
 *
 * GET    /api/match-plans/:fixtureId       - Get or create plan for fixture
 * PUT    /api/match-plans/:fixtureId/slots - Update slots (full period replacement)
 * POST   /api/match-plans/:fixtureId/generate - Generate plan using engine
 * PUT    /api/match-plans/:fixtureId/status - Update plan status
 * DELETE /api/match-plans/:fixtureId/slots - Clear all slots
 */

const router = Router();

// Get or create plan
router.get('/:fixtureId', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const clubId = getClubId(req);
  const result = await matchPlanService.getOrCreatePlan(fixtureId, clubId);

  if (!result.success) {
    res.status(404).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.json({ data: result.data });
}));

// Update slots
router.put('/:fixtureId/slots', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const { slots } = req.body;

  if (!Array.isArray(slots)) {
    res.status(400).json({ error: 'INVALID_INPUT', message: 'slots must be an array' });
    return;
  }

  const result = await matchPlanService.updateSlots(fixtureId, slots);

  if (!result.success) {
    res.status(400).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.json({ data: result.data });
}));

// Generate plan
router.post('/:fixtureId/generate', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const clubId = getClubId(req);
  const { gkAssignments } = req.body || {};

  const result = await matchPlanService.generatePlan(fixtureId, clubId, gkAssignments);

  if (!result.success) {
    const status = result.error.code === 'NO_AVAILABLE_PLAYERS' ? 400 :
                   result.error.code === 'NOT_ENOUGH_PLAYERS' ? 400 :
                   result.error.code === 'NO_GK_VOLUNTEERS' ? 400 : 404;
    res.status(status).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.json({ data: result.data });
}));

// Update status
router.put('/:fixtureId/status', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const { status } = req.body;

  const result = await matchPlanService.updateStatus(fixtureId, status);

  if (!result.success) {
    res.status(400).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.json({ data: result.data });
}));

// Clear plan
router.delete('/:fixtureId/slots', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const result = await matchPlanService.clearPlan(fixtureId);

  if (!result.success) {
    res.status(404).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.json({ data: result.data });
}));

export const matchPlanRoutes = router;
