import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { clubs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Club API Routes
 *
 * PATCH /api/clubs/:id - Update club fields (name, teamName, ageGroup)
 */

const router = Router();

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { name, teamName, ageGroup } = req.body;

  // Validate club exists
  const existing = db.select().from(clubs).where(eq(clubs.id, id)).get();
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

  db.update(clubs).set(updates).where(eq(clubs.id, id)).run();

  const updated = db.select().from(clubs).where(eq(clubs.id, id)).get();
  res.json({ data: updated });
}));

export const clubRoutes = router;
