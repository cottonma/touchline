import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { seasons } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Season API Routes
 *
 * GET /api/seasons - Get all seasons
 * PATCH /api/seasons/:id - Update season fields
 */

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const allSeasons = await db.select().from(seasons);
  res.json({ data: allSeasons });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { format, matchDurationMinutes, periods, formation, maxSquadSize } = req.body;

  // Validate season exists
  const [existing] = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: 'Season not found' });
    return;
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (format !== undefined) {
    const validFormats = ['5v5', '7v7', '9v9', '11v11'];
    if (!validFormats.includes(format)) {
      res.status(400).json({ error: 'Invalid format. Must be one of: 5v5, 7v7, 9v9, 11v11' });
      return;
    }
    updates.format = format;
  }

  if (matchDurationMinutes !== undefined) {
    const mins = Number(matchDurationMinutes);
    if (isNaN(mins) || mins < 10 || mins > 120) {
      res.status(400).json({ error: 'matchDurationMinutes must be between 10 and 120' });
      return;
    }
    updates.matchDurationMinutes = mins;
  }

  if (periods !== undefined) {
    const p = Number(periods);
    if (isNaN(p) || p < 1 || p > 6) {
      res.status(400).json({ error: 'periods must be between 1 and 6' });
      return;
    }
    updates.periods = p;
  }

  if (maxSquadSize !== undefined) {
    const size = Number(maxSquadSize);
    if (isNaN(size) || size < 5 || size > 30) {
      res.status(400).json({ error: 'maxSquadSize must be between 5 and 30' });
      return;
    }
    updates.maxSquadSize = size;
  }

  if (formation !== undefined) {
    // Allow null to clear formation, or validate string format
    if (formation !== null) {
      const parts = String(formation).split('-').map(Number);
      if (parts.some(n => isNaN(n) || n < 1)) {
        res.status(400).json({ error: 'Invalid formation format. Use numbers separated by dashes, e.g. "2-3-1"' });
        return;
      }
    }
    updates.formation = formation;
  }

  await db.update(seasons).set(updates).where(eq(seasons.id, id));

  const [updated] = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  res.json({ data: updated });
}));

export const seasonRoutes = router;
