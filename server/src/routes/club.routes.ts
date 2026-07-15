import { Router } from 'express';
import { nanoid } from 'nanoid';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { clubs, seasons } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Club API Routes
 *
 * POST  /api/clubs     - Create a new club + default season
 * PATCH /api/clubs/:id - Update club fields (name, teamName, ageGroup)
 */

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { name, teamName, ageGroup } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required and must be a non-empty string' });
    return;
  }

  const now = new Date().toISOString();
  const clubId = nanoid();
  const currentYear = new Date().getFullYear();

  // Create the club
  await db.insert(clubs).values({
    id: clubId,
    name: name.trim(),
    teamName: teamName ? String(teamName).trim() : null,
    ageGroup: ageGroup || null,
    createdAt: now,
    updatedAt: now,
  } as any);

  // Create a default season for the new club
  const seasonId = nanoid();
  await db.insert(seasons).values({
    id: seasonId,
    clubId,
    name: `${currentYear}/${currentYear + 1} Season`,
    startDate: `${currentYear}-08-01`,
    endDate: `${currentYear + 1}-06-30`,
    format: '7v7',
    matchDurationMinutes: 48,
    periods: 4,
    maxSquadSize: 12,
    formation: '2-3-1',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  } as any);

  const [created] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  res.status(201).json({ data: created });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { name, teamName, ageGroup } = req.body;

  // Validate club exists
  const [existing] = await db.select().from(clubs).where(eq(clubs.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: 'Club not found' });
    return;
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name must be a non-empty string' });
      return;
    }
    updates.name = name.trim();
  }

  if (teamName !== undefined) {
    updates.teamName = teamName ? String(teamName).trim() : null;
  }

  if (ageGroup !== undefined) {
    const validAgeGroups = ['U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16'];
    if (ageGroup !== null && !validAgeGroups.includes(ageGroup)) {
      res.status(400).json({ error: `ageGroup must be one of: ${validAgeGroups.join(', ')}` });
      return;
    }
    updates.ageGroup = ageGroup;
  }

  await db.update(clubs).set(updates).where(eq(clubs.id, id));

  const [updated] = await db.select().from(clubs).where(eq(clubs.id, id)).limit(1);
  res.json({ data: updated });
}));

export const clubRoutes = router;
