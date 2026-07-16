import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { scoutReports } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Scout Report API Routes
 *
 * GET    /api/scout-reports?opponent=...&fixtureId=...  - List reports (filterable)
 * GET    /api/scout-reports/:id                         - Get single report
 * POST   /api/scout-reports                             - Create new report
 * PUT    /api/scout-reports/:id                         - Update report
 * DELETE /api/scout-reports/:id                         - Delete report
 */

const router = Router();

// GET /api/scout-reports
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opponent = req.query.opponent as string | undefined;
    const fixtureId = req.query.fixtureId as string | undefined;

    let query = db.select().from(scoutReports);

    if (opponent) {
      query = query.where(eq(scoutReports.opponent, opponent)) as any;
    } else if (fixtureId) {
      query = query.where(eq(scoutReports.fixtureId, fixtureId)) as any;
    }

    const reports = await (query as any).orderBy(desc(scoutReports.createdAt));

    res.json({ data: reports });
  })
);

// GET /api/scout-reports/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const [report] = await db
      .select()
      .from(scoutReports)
      .where(eq(scoutReports.id, id))
      .limit(1);

    if (!report) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Scout report not found.' });
      return;
    }

    res.json({ data: report });
  })
);

// POST /api/scout-reports
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body;

    if (!body.opponent) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'opponent is required.' });
      return;
    }

    const now = new Date().toISOString();
    const newReport = {
      id: nanoid(),
      fixtureId: body.fixtureId || null,
      opponent: body.opponent,
      scoutName: body.scoutName || null,
      date: body.date || null,
      finalScore: body.finalScore || null,
      formation: body.formation || null,
      styleOfPlay: body.styleOfPlay || null,
      keyPlayers: body.keyPlayers || null,
      attackDirection: body.attackDirection || null,
      chanceCreation: body.chanceCreation || null,
      attackingNotes: body.attackingNotes || null,
      defensiveStyle: body.defensiveStyle || null,
      weaknesses: body.weaknesses || null,
      defensiveNotes: body.defensiveNotes || null,
      cornersRating: body.cornersRating || null,
      gkRating: body.gkRating || null,
      gkDistribution: body.gkDistribution || null,
      setPieceNotes: body.setPieceNotes || null,
      threats: body.threats || null,
      opportunities: body.opportunities || null,
      attackBy: body.attackBy || null,
      defendBy: body.defendBy || null,
      confidenceRating: body.confidenceRating || null,
      overallComments: body.overallComments || null,
      teamPerformanceRating: body.teamPerformanceRating || null,
      teamStrengths: body.teamStrengths || null,
      teamWeaknesses: body.teamWeaknesses || null,
      teamNotes: body.teamNotes || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(scoutReports).values(newReport);

    res.status(201).json({ data: newReport });
  })
);

// PUT /api/scout-reports/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const body = req.body;

    const [existing] = await db
      .select()
      .from(scoutReports)
      .where(eq(scoutReports.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Scout report not found.' });
      return;
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = { updatedAt: now };

    // Only update fields that are present in body
    const fields = [
      'fixtureId', 'opponent', 'scoutName', 'date', 'finalScore',
      'formation', 'styleOfPlay', 'keyPlayers',
      'attackDirection', 'chanceCreation', 'attackingNotes',
      'defensiveStyle', 'weaknesses', 'defensiveNotes',
      'cornersRating', 'gkRating', 'gkDistribution', 'setPieceNotes',
      'threats', 'opportunities',
      'attackBy', 'defendBy', 'confidenceRating', 'overallComments',
      'teamPerformanceRating', 'teamStrengths', 'teamWeaknesses', 'teamNotes',
    ];

    for (const field of fields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    await db.update(scoutReports).set(updates).where(eq(scoutReports.id, id));

    const [updated] = await db
      .select()
      .from(scoutReports)
      .where(eq(scoutReports.id, id))
      .limit(1);

    res.json({ data: updated });
  })
);

// DELETE /api/scout-reports/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const [existing] = await db
      .select()
      .from(scoutReports)
      .where(eq(scoutReports.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Scout report not found.' });
      return;
    }

    await db.delete(scoutReports).where(eq(scoutReports.id, id));

    res.json({ data: { message: 'Scout report deleted.' } });
  })
);

export const scoutReportRoutes = router;
