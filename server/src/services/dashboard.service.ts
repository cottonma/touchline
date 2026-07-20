import { db } from '../db/index.js';
import { players, fixtures, matchResults, playingTime, availability, seasons } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

/**
 * Dashboard Service - Aggregates data from all modules into a single dashboard response.
 * 
 * Data provided:
 * - Next fixture (with countdown)
 * - Availability summary for next fixture
 * - Squad size
 * - Recent results (last 5)
 * - Playing time balance (season totals per player)
 * - Outstanding actions (unrecorded matches, unknown availability)
 */

export interface DashboardData {
  nextFixture: {
    id: string;
    type: string;
    opponent: string | null;
    date: string;
    kickOffTime: string | null;
    location: string | null;
    homeAway: string | null;
    daysUntil: number;
  } | null;
  availability: {
    fixtureId: string | null;
    available: number;
    unavailable: number;
    unknown: number;
    total: number;
  };
  squad: {
    activeCount: number;
    gkVolunteers: number;
  };
  recentResults: {
    fixtureId: string;
    date: string;
    opponent: string | null;
    goalsFor: number;
    goalsAgainst: number;
    result: string | null;
  }[];
  seasonStats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  };
  playingTimeBalance: {
    playerName: string;
    totalMinutes: number;
    outfieldMinutes: number;
  }[];
  outstandingActions: string[];
}

export class DashboardService {
  async getDashboardData(clubId?: string): Promise<DashboardData> {
    const today = new Date().toISOString().split('T')[0];

    // Get the active season for this club (for filtering fixtures)
    let seasonId: string | undefined;
    if (clubId) {
      const [season] = await db.select().from(seasons).where(and(eq(seasons.clubId, clubId), eq(seasons.isActive, true))).limit(1);
      seasonId = season?.id;
    }

    // Squad (filtered by club)
    const playerConditions = [eq(players.isActive, true)];
    if (clubId) playerConditions.push(eq(players.clubId, clubId));
    const allPlayers = await db.select().from(players).where(and(...playerConditions));
    const gkVolunteers = allPlayers.filter((p) => p.isGkVolunteer).length;

    // Fixtures (filtered by season)
    let allFixtures;
    if (seasonId) {
      allFixtures = await db.select().from(fixtures).where(eq(fixtures.seasonId, seasonId));
    } else {
      allFixtures = await db.select().from(fixtures);
    }
    const upcoming = allFixtures
      .filter((f) => f.status === 'scheduled' && f.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const nextFix = upcoming[0] ?? null;

    let nextFixture: DashboardData['nextFixture'] = null;
    if (nextFix) {
      const daysUntil = Math.ceil(
        (new Date(nextFix.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
      );
      nextFixture = {
        id: nextFix.id,
        type: nextFix.type,
        opponent: nextFix.opponent,
        date: nextFix.date,
        kickOffTime: nextFix.kickOffTime,
        location: nextFix.location,
        homeAway: nextFix.homeAway,
        daysUntil,
      };
    }

    // Availability for next fixture
    let availabilitySummary: DashboardData['availability'] = {
      fixtureId: null,
      available: 0,
      unavailable: 0,
      unknown: allPlayers.length,
      total: allPlayers.length,
    };

    if (nextFix) {
      const allAvailability = await db.select().from(availability);
      const fixtureAvail = allAvailability.filter((a) => a.fixtureId === nextFix.id);
      // Only count availability for players in this club's squad
      const clubPlayerIds = new Set(allPlayers.map(p => p.id));
      const clubFixtureAvail = fixtureAvail.filter((a) => clubPlayerIds.has(a.playerId));
      const availCount = clubFixtureAvail.filter((a) => a.status === 'available').length;
      const unavailCount = clubFixtureAvail.filter((a) => a.status === 'unavailable').length;
      const unknownCount = allPlayers.length - availCount - unavailCount;

      availabilitySummary = {
        fixtureId: nextFix.id,
        available: availCount,
        unavailable: unavailCount,
        unknown: unknownCount,
        total: allPlayers.length,
      };
    }

    // Recent results (last 5)
    const allResults = await db.select().from(matchResults);
    const completedMatches = allFixtures
      .filter((f) => f.status === 'completed' && f.type !== 'training')
      .sort((a, b) => b.date.localeCompare(a.date));

    const recentResults = completedMatches.slice(0, 5).map((f) => {
      const result = allResults.find((r) => r.fixtureId === f.id);
      return {
        fixtureId: f.id,
        date: f.date,
        opponent: f.opponent,
        goalsFor: result?.goalsFor ?? 0,
        goalsAgainst: result?.goalsAgainst ?? 0,
        result: result?.result ?? null,
      };
    });

    // Season stats
    const seasonResults = allResults.filter((r) =>
      completedMatches.some((f) => f.id === r.fixtureId)
    );
    const seasonStats = {
      played: seasonResults.length,
      won: seasonResults.filter((r) => r.result === 'win').length,
      drawn: seasonResults.filter((r) => r.result === 'draw').length,
      lost: seasonResults.filter((r) => r.result === 'loss').length,
      goalsFor: seasonResults.reduce((sum, r) => sum + r.goalsFor, 0),
      goalsAgainst: seasonResults.reduce((sum, r) => sum + r.goalsAgainst, 0),
    };

    // Playing time balance
    const allPlayingTime = await db.select().from(playingTime);
    const playingTimeBalance = allPlayers.map((p) => {
      const pt = allPlayingTime.filter((r) => r.playerId === p.id);
      return {
        playerName: `${p.firstName} ${p.lastName}`,
        totalMinutes: pt.reduce((sum, r) => sum + r.totalMinutes, 0),
        outfieldMinutes: pt.reduce((sum, r) => sum + r.outfieldMinutes, 0),
      };
    }).sort((a, b) => a.outfieldMinutes - b.outfieldMinutes);

    // Outstanding actions
    const outstandingActions: string[] = [];
    
    // Unrecorded completed matches (fixtures marked complete but no match result)
    const unrecorded = completedMatches.filter((f) => !allResults.some((r) => r.fixtureId === f.id));
    if (unrecorded.length > 0) {
      outstandingActions.push(`${unrecorded.length} match${unrecorded.length > 1 ? 'es' : ''} need results recording`);
    }

    // Unknown availability for next fixture
    if (availabilitySummary.unknown > 0 && nextFix) {
      outstandingActions.push(`${availabilitySummary.unknown} player${availabilitySummary.unknown > 1 ? 's' : ''} with unknown availability`);
    }

    return {
      nextFixture,
      availability: availabilitySummary,
      squad: { activeCount: allPlayers.length, gkVolunteers },
      recentResults,
      seasonStats,
      playingTimeBalance,
      outstandingActions,
    };
  }
}

export const dashboardService = new DashboardService();
