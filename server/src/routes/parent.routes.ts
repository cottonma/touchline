import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { users, fixtures, seasons, players, availability, motmVotes } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const parentRoutes = Router();

/**
 * GET /api/parent/my-child
 * Returns the player linked to this parent account.
 */
parentRoutes.get('/my-child', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get the user record to find playerId
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !(user as any).playerId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No child linked to this account' });
      return;
    }

    const [player] = await db.select().from(players).where(eq(players.id, (user as any).playerId)).limit(1);
    if (!player) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Linked player not found' });
      return;
    }

    res.json(player);
  } catch (err) {
    console.error('[parent/my-child]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to get child info' });
  }
});

/**
 * GET /api/parent/fixtures
 * Returns upcoming fixtures for the parent's team (uses clubId from token).
 */
parentRoutes.get('/fixtures', async (req, res) => {
  try {
    const clubIds = req.user!.clubIds;
    if (!clubIds || clubIds.length === 0) {
      res.json([]);
      return;
    }

    // Get active seasons for the parent's clubs
    const allSeasons = await db.select().from(seasons).where(eq(seasons.clubId, clubIds[0]));
    const activeSeason = allSeasons.find((s) => s.isActive);
    if (!activeSeason) {
      res.json([]);
      return;
    }

    // Get all fixtures for the active season
    const allFixtures = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.seasonId, activeSeason.id))
      .orderBy(fixtures.date);

    res.json(allFixtures);
  } catch (err) {
    console.error('[parent/fixtures]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to get fixtures' });
  }
});

/**
 * POST /api/parent/availability
 * Mark child available/unavailable for a fixture.
 * Body: { fixtureId, status: 'available' | 'unavailable' }
 */
parentRoutes.post('/availability', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fixtureId, status } = req.body;

    if (!fixtureId || !status || !['available', 'unavailable'].includes(status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'fixtureId and status (available/unavailable) are required' });
      return;
    }

    // Get parent's linked player
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !(user as any).playerId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'No child linked to this account' });
      return;
    }
    const playerId = (user as any).playerId;

    // Check if availability record exists for this fixture + player
    const [existing] = await db
      .select()
      .from(availability)
      .where(and(eq(availability.fixtureId, fixtureId), eq(availability.playerId, playerId)))
      .limit(1);

    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      await db
        .update(availability)
        .set({ status, updatedAt: now })
        .where(eq(availability.id, existing.id));
    } else {
      // Create new
      await db.insert(availability).values({
        id: nanoid(),
        fixtureId,
        playerId,
        status,
        updatedAt: now,
      } as any);
    }

    res.json({ success: true, fixtureId, playerId, status });
  } catch (err) {
    console.error('[parent/availability]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to update availability' });
  }
});

/**
 * GET /api/parent/motm/:fixtureId
 * Get current MOTM vote for this parent for a specific fixture.
 */
parentRoutes.get('/motm/:fixtureId', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fixtureId } = req.params;

    const [vote] = await db
      .select()
      .from(motmVotes)
      .where(and(eq(motmVotes.fixtureId, fixtureId), eq(motmVotes.voterId, userId)))
      .limit(1);

    res.json({ vote: vote || null });
  } catch (err) {
    console.error('[parent/motm]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to get MOTM vote' });
  }
});

/**
 * POST /api/parent/motm
 * Cast or update MOTM vote. Cannot vote for own child.
 * Body: { fixtureId, playerId }
 */
parentRoutes.post('/motm', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fixtureId, playerId } = req.body;

    if (!fixtureId || !playerId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'fixtureId and playerId are required' });
      return;
    }

    // Get parent's linked player to enforce can't-vote-for-own-child rule
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !(user as any).playerId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'No child linked to this account' });
      return;
    }

    if ((user as any).playerId === playerId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot vote for your own child' });
      return;
    }

    // Upsert: check if vote already exists for this voter + fixture
    const [existing] = await db
      .select()
      .from(motmVotes)
      .where(and(eq(motmVotes.fixtureId, fixtureId), eq(motmVotes.voterId, userId)))
      .limit(1);

    const now = new Date().toISOString();

    if (existing) {
      // Update existing vote
      await db
        .update(motmVotes)
        .set({ playerId, createdAt: now })
        .where(eq(motmVotes.id, existing.id));
    } else {
      // Create new vote
      await db.insert(motmVotes).values({
        id: nanoid(),
        fixtureId,
        voterId: userId,
        playerId,
        createdAt: now,
      } as any);
    }

    res.json({ success: true, fixtureId, playerId });
  } catch (err) {
    console.error('[parent/motm]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to cast MOTM vote' });
  }
});
