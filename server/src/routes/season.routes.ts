import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { seasons } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getClubId } from '../middleware/team-context.js';
import { nanoid } from 'nanoid';

/**
 * Season API Routes
 *
 * GET /api/seasons - Get seasons (filtered by active club)
 * POST /api/seasons - Create a new season
 * PATCH /api/seasons/:id - Update season fields
 */

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const clubId = getClubId(req);
  let allSeasons;
  if (clubId) {
    allSeasons = await db.select().from(seasons).where(eq(seasons.clubId, clubId));
  } else {
    allSeasons = await db.select().from(seasons);
  }
  res.json({ data: allSeasons });
}));

router.post('/', asyncHandler(async (req, res) => {
  const clubId = getClubId(req);
  if (!clubId) {
    res.status(400).json({ error: 'No active club' });
    return;
  }

  const { format, matchDurationMinutes, periods, maxSquadSize, formation, name } = req.body;
  const currentYear = new Date().getFullYear();

  // Deactivate all existing seasons for this club
  await db.update(seasons).set({ isActive: false, updatedAt: new Date().toISOString() }).where(eq(seasons.clubId, clubId));

  const id = nanoid();
  await db.insert(seasons).values({
    id,
    clubId,
    name: name || `${currentYear}/${currentYear + 1} Season`,
    startDate: `${currentYear}-08-01`,
    endDate: `${currentYear + 1}-06-30`,
    format: format || '7v7',
    matchDurationMinutes: matchDurationMinutes || 48,
    periods: periods || 4,
    maxSquadSize: maxSquadSize || 12,
    formation: formation || null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);

  const [created] = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  res.status(201).json({ data: created });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { format, matchDurationMinutes, periods, formation, maxSquadSize, name } = req.body;

  // Validate season exists
  const [existing] = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: 'Season not found' });
    return;
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (name !== undefined) {
    updates.name = String(name).trim();
  }

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
