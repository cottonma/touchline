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

// ─── PLAN VERSIONS ───────────────────────────────────────────────────────────

import { db } from '../db/index.js';
import { matchPlans, matchPlanSlots, matchPlanVersions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// List saved versions for a fixture
router.get('/:fixtureId/versions', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
  if (!plan) { res.json({ data: [] }); return; }

  const versions = await db.select().from(matchPlanVersions).where(eq(matchPlanVersions.matchPlanId, plan.id));
  res.json({ data: versions });
}));

// Save current plan as a named version
router.post('/:fixtureId/versions', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

  const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
  if (!plan) { res.status(404).json({ error: 'No plan found' }); return; }

  const slots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));

  const versionId = nanoid();
  await db.insert(matchPlanVersions).values({
    id: versionId,
    matchPlanId: plan.id,
    name,
    slotsSnapshot: JSON.stringify(slots),
    formation: plan.formation,
    generatedBy: plan.generatedBy,
    isFinal: false,
    createdAt: new Date().toISOString(),
  });

  const [saved] = await db.select().from(matchPlanVersions).where(eq(matchPlanVersions.id, versionId)).limit(1);
  res.status(201).json({ data: saved });
}));

// Restore a saved version (replaces working plan slots)
router.post('/:fixtureId/versions/:versionId/restore', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const versionId = req.params.versionId as string;

  const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
  if (!plan) { res.status(404).json({ error: 'No plan found' }); return; }

  const [version] = await db.select().from(matchPlanVersions).where(eq(matchPlanVersions.id, versionId)).limit(1);
  if (!version) { res.status(404).json({ error: 'Version not found' }); return; }

  const snapshotSlots = JSON.parse(version.slotsSnapshot) as any[];
  const now = new Date().toISOString();

  // Clear existing working slots
  const existing = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));
  for (const s of existing) { await db.delete(matchPlanSlots).where(eq(matchPlanSlots.id, s.id)); }

  // Insert snapshot slots as new working slots
  for (const s of snapshotSlots) {
    await db.insert(matchPlanSlots).values({
      id: nanoid(),
      matchPlanId: plan.id,
      period: s.period,
      playerId: s.playerId,
      position: s.position,
      isGk: s.isGk ?? false,
      startMinute: s.startMinute ?? 0,
      endMinute: s.endMinute,
      createdAt: now,
    });
  }

  // Update plan metadata
  await db.update(matchPlans).set({ formation: version.formation, generatedBy: version.generatedBy, updatedAt: now }).where(eq(matchPlans.id, plan.id));

  const allSlots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));
  const [updatedPlan] = await db.select().from(matchPlans).where(eq(matchPlans.id, plan.id)).limit(1);
  res.json({ data: { plan: updatedPlan, slots: allSlots } });
}));

// Mark a version as the final match plan
router.put('/:fixtureId/versions/:versionId/final', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const versionId = req.params.versionId as string;

  const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
  if (!plan) { res.status(404).json({ error: 'No plan found' }); return; }

  // Unmark all other versions as not final
  const allVersions = await db.select().from(matchPlanVersions).where(eq(matchPlanVersions.matchPlanId, plan.id));
  for (const v of allVersions) {
    await db.update(matchPlanVersions).set({ isFinal: false }).where(eq(matchPlanVersions.id, v.id));
  }

  // Mark this version as final
  await db.update(matchPlanVersions).set({ isFinal: true }).where(eq(matchPlanVersions.id, versionId));
  await db.update(matchPlans).set({ status: 'ready', updatedAt: new Date().toISOString() }).where(eq(matchPlans.id, plan.id));

  res.json({ data: { success: true } });
}));

// Delete a version
router.delete('/:fixtureId/versions/:versionId', asyncHandler(async (req, res) => {
  const versionId = req.params.versionId as string;
  await db.delete(matchPlanVersions).where(eq(matchPlanVersions.id, versionId));
  res.json({ data: { success: true } });
}));

// ─── MATCH COMPLETION ────────────────────────────────────────────────────────

import { matchCompletionService } from '../services/match-completion.service.js';

// Complete match — calculates actual minutes from plan structure
router.post('/:fixtureId/complete', asyncHandler(async (req, res) => {
  const fixtureId = req.params.fixtureId as string;
  const { periodScores, coachNotes, motmPlayerId, goals: goalEntries } = req.body;

  if (!Array.isArray(periodScores)) {
    res.status(400).json({ error: 'periodScores must be an array' });
    return;
  }

  const result = await matchCompletionService.completeMatch({
    fixtureId,
    periodScores,
    coachNotes,
    motmPlayerId,
    goalEntries: goalEntries ?? [],
  });

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ data: result.data });
}));
