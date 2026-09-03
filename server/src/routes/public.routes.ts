import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { clubs, seasons, fixtures, players, availability } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Public (no-login) routes for parent availability.
 *
 * A club has a single shareable token. A coach posts the link once in the
 * team WhatsApp group. Any parent opens it, picks which player they are
 * responding for, and sets availability for upcoming fixtures.
 *
 * These routes MUST be registered BEFORE the global auth middleware so they
 * remain publicly accessible.
 */
export const publicRoutes = Router();

/** Resolve a club from its public availability token. */
async function clubByToken(token: string) {
  if (!token) return null;
  const [club] = await db
    .select()
    .from(clubs)
    .where(eq((clubs as any).publicAvailabilityToken, token))
    .limit(1);
  return club ?? null;
}

/**
 * GET /api/public/availability/:token
 * Returns club name, upcoming fixtures (with details), the squad, and each
 * player's current availability status for those fixtures.
 */
publicRoutes.get('/availability/:token', asyncHandler(async (req, res) => {
  const token = req.params.token as string;
  const club = await clubByToken(token);
  if (!club) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'This availability link is not valid.' });
    return;
  }

  // Active season for this club → to scope fixtures
  const clubSeasons = await db.select().from(seasons).where(eq(seasons.clubId, club.id));
  const activeSeason = clubSeasons.find((s) => s.isActive) ?? clubSeasons[0];
  if (!activeSeason) {
    res.json({ data: { clubName: club.name, players: [], fixtures: [] } });
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  // Upcoming, non-training fixtures for the season
  const allFixtures = await db.select().from(fixtures).where(eq(fixtures.seasonId, activeSeason.id));
  const upcoming = allFixtures
    .filter((f) => f.type !== 'training' && f.status === 'scheduled' && f.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({
      id: f.id,
      opponent: f.opponent,
      location: f.location,
      date: f.date,
      kickOffTime: f.kickOffTime,
      homeAway: f.homeAway,
    }));

  // Active squad for this club
  const squad = (await db.select().from(players).where(and(eq(players.clubId, club.id), eq(players.isActive, true))))
    .map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, shirtNumber: p.shirtNumber }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  // Current availability for the upcoming fixtures
  const fixtureIds = new Set(upcoming.map((f) => f.id));
  const squadIds = new Set(squad.map((p) => p.id));
  const allAvailability = await db.select().from(availability);
  const statuses = allAvailability
    .filter((a) => fixtureIds.has(a.fixtureId) && squadIds.has(a.playerId))
    .map((a) => ({ fixtureId: a.fixtureId, playerId: a.playerId, status: a.status }));

  res.json({ data: { clubName: club.name, players: squad, fixtures: upcoming, statuses } });
}));

/**
 * POST /api/public/availability/:token
 * Body: { fixtureId, playerId, status: 'available' | 'unavailable' }
 * Upserts into the same availability table the coach's manual flow uses.
 */
publicRoutes.post('/availability/:token', asyncHandler(async (req, res) => {
  const token = req.params.token as string;
  const { fixtureId, playerId, status } = req.body ?? {};

  if (!fixtureId || !playerId || !['available', 'unavailable'].includes(status)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'fixtureId, playerId and a valid status are required.' });
    return;
  }

  const club = await clubByToken(token);
  if (!club) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'This availability link is not valid.' });
    return;
  }

  // Verify the player belongs to this club (prevents cross-club writes via a token)
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player || player.clubId !== club.id) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'That player is not part of this team.' });
    return;
  }

  // Verify the fixture belongs to one of this club's seasons
  const clubSeasons = await db.select().from(seasons).where(eq(seasons.clubId, club.id));
  const clubSeasonIds = new Set(clubSeasons.map((s) => s.id));
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture || !clubSeasonIds.has(fixture.seasonId)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'That fixture is not part of this team.' });
    return;
  }

  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(availability)
    .where(and(eq(availability.fixtureId, fixtureId), eq(availability.playerId, playerId)))
    .limit(1);

  if (existing) {
    await db.update(availability).set({ status, updatedAt: now }).where(eq(availability.id, existing.id));
  } else {
    await db.insert(availability).values({
      id: nanoid(),
      fixtureId,
      playerId,
      status,
      updatedAt: now,
    } as any);
  }

  res.json({ success: true, fixtureId, playerId, status });
}));
