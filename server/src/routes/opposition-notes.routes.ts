import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { oppositionNotes } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Opposition Notes API Routes
 *
 * GET  /api/opposition-notes?opponent=...  - Get all notes for an opponent
 * POST /api/opposition-notes               - Save new opposition notes
 */

const router = Router();

// GET /api/opposition-notes?opponent=Valley+United
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opponent = req.query.opponent as string | undefined;

    if (!opponent) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'opponent query param is required.' });
      return;
    }

    const notes = await db
      .select()
      .from(oppositionNotes)
      .where(eq(oppositionNotes.opponent, opponent))
      .orderBy(desc(oppositionNotes.createdAt));

    res.json({ data: notes });
  })
);

// POST /api/opposition-notes
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { opponent, fixtureId, notes } = req.body;

    if (!opponent || !notes) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'opponent and notes are required.' });
      return;
    }

    const now = new Date().toISOString();
    const newNote = {
      id: nanoid(),
      opponent,
      fixtureId: fixtureId || null,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(oppositionNotes).values(newNote);

    res.status(201).json({ data: newNote });
  })
);

export const oppositionNotesRoutes = router;
