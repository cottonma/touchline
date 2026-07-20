import { Router } from 'express';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { playerController } from '../controllers/player.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { db } from '../db/index.js';
import { trainingAttendance, trainingSessions, playingTime, fixtures } from '../db/schema.js';
import { getActiveSeasonId } from '../middleware/team-context.js';

/**
 * Player API Routes
 * 
 * GET    /api/players          - List all players
 * GET    /api/players/:id      - Get player by ID
 * GET    /api/players/:id/stats - Get player season statistics
 * POST   /api/players          - Create a new player
 * PUT    /api/players/:id      - Update a player
 * DELETE /api/players/:id      - Deactivate a player (soft delete)
 * POST   /api/players/:id/reactivate - Reactivate a player
 */

const router = Router();

router.get('/', asyncHandler((req, res) => playerController.getAll(req, res)));

// Player stats endpoint - must be before /:id to avoid conflict
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const seasonId = await getActiveSeasonId(req);

  // Get fixture IDs for the active season (so we only count this season's stats)
  let seasonFixtureIds: string[] = [];
  if (seasonId) {
    const seasonFixtures = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.seasonId, seasonId));
    seasonFixtureIds = seasonFixtures.map(f => f.id);
  }

  // Count training sessions attended by this player
  const [attendedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingAttendance)
    .where(and(eq(trainingAttendance.playerId, id), eq(trainingAttendance.attended, true)));

  // Count total training sessions
  const [totalSessionsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingSessions);

  // Count matches played (total_minutes > 0) — only for this season's fixtures
  let matchesPlayed = 0;
  let totalOutfieldMinutes = 0;
  let totalGkMinutes = 0;

  if (seasonFixtureIds.length > 0) {
    const [matchesPlayedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playingTime)
      .where(and(
        eq(playingTime.playerId, id),
        inArray(playingTime.fixtureId, seasonFixtureIds),
        sql`${playingTime.totalMinutes} > 0`
      ));
    matchesPlayed = matchesPlayedResult?.count ?? 0;

    const [minutesResult] = await db
      .select({
        totalOutfieldMinutes: sql<number>`coalesce(sum(${playingTime.outfieldMinutes}), 0)`,
        totalGkMinutes: sql<number>`coalesce(sum(${playingTime.goalkeeperMinutes}), 0)`,
      })
      .from(playingTime)
      .where(and(
        eq(playingTime.playerId, id),
        inArray(playingTime.fixtureId, seasonFixtureIds)
      ));
    totalOutfieldMinutes = minutesResult?.totalOutfieldMinutes ?? 0;
    totalGkMinutes = minutesResult?.totalGkMinutes ?? 0;
  }

  res.json({
    data: {
      trainingSessionsAttended: attendedResult?.count ?? 0,
      totalTrainingSessions: totalSessionsResult?.count ?? 0,
      matchesPlayed,
      totalOutfieldMinutes,
      totalGkMinutes,
    },
  });
}));

router.get('/:id', asyncHandler((req, res) => playerController.getById(req, res)));
router.post('/', asyncHandler((req, res) => playerController.create(req, res)));
router.put('/:id', asyncHandler((req, res) => playerController.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => playerController.deactivate(req, res)));
router.post('/:id/reactivate', asyncHandler((req, res) => playerController.reactivate(req, res)));

export const playerRoutes = router;
