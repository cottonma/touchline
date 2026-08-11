import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { scoutObservations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Scout Observation API Routes
 *
 * GET  /api/scout-observations?fixtureId=&playerId=  - List observations
 * POST /api/scout-observations                        - Add observation
 * PUT  /api/scout-observations/:id                    - Update observation
 * DELETE /api/scout-observations/:id                  - Delete observation
 */

const router = Router();

// List observations with optional filters
router.get('/', asyncHandler(async (req, res) => {
  const fixtureId = req.query.fixtureId as string | undefined;
  const playerId = req.query.playerId as string | undefined;

  let results;
  if (fixtureId && playerId) {
    results = await db.select().from(scoutObservations)
      .where(and(eq(scoutObservations.fixtureId, fixtureId), eq(scoutObservations.playerId, playerId)));
  } else if (fixtureId) {
    results = await db.select().from(scoutObservations).where(eq(scoutObservations.fixtureId, fixtureId));
  } else if (playerId) {
    results = await db.select().from(scoutObservations).where(eq(scoutObservations.playerId, playerId));
  } else {
    results = await db.select().from(scoutObservations);
  }

  res.json({ data: results });
}));

// Add observation
router.post('/', asyncHandler(async (req, res) => {
  const { fixtureId, playerId, period, matchMinute, developmentArea, observationType, observation } = req.body;

  if (!fixtureId || !developmentArea || !observation) {
    res.status(400).json({ error: 'fixtureId, developmentArea, and observation are required' });
    return;
  }

  const validAreas = ['physical', 'technical', 'mental', 'teamwork'];
  if (!validAreas.includes(developmentArea)) {
    res.status(400).json({ error: `developmentArea must be one of: ${validAreas.join(', ')}` });
    return;
  }

  const now = new Date().toISOString();
  const id = nanoid();

  await db.insert(scoutObservations).values({
    id,
    fixtureId,
    playerId: playerId ?? null,
    scoutId: req.user?.userId ?? null,
    period: period ?? null,
    matchMinute: matchMinute ?? null,
    developmentArea,
    observationType: observationType ?? 'general',
    observation,
    followUp: null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(scoutObservations).where(eq(scoutObservations.id, id)).limit(1);
  res.status(201).json({ data: created });
}));

// Update observation
router.put('/:id', asyncHandler(async (req, res) => {
  const obsId = req.params.id as string;
  const { observation, developmentArea, observationType, period, matchMinute, followUp } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (observation !== undefined) updates.observation = observation;
  if (developmentArea !== undefined) updates.developmentArea = developmentArea;
  if (observationType !== undefined) updates.observationType = observationType;
  if (period !== undefined) updates.period = period;
  if (matchMinute !== undefined) updates.matchMinute = matchMinute;
  if (followUp !== undefined) updates.followUp = followUp;

  await db.update(scoutObservations).set(updates).where(eq(scoutObservations.id, obsId));

  const [updated] = await db.select().from(scoutObservations).where(eq(scoutObservations.id, obsId)).limit(1);
  res.json({ data: updated });
}));

// Delete observation
router.delete('/:id', asyncHandler(async (req, res) => {
  const obsId = req.params.id as string;
  await db.delete(scoutObservations).where(eq(scoutObservations.id, obsId));
  res.json({ data: { success: true } });
}));

export const scoutObservationRoutes = router;
