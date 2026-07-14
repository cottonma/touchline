import { db } from '../db/index.js';
import { goals, playingTime, matchResults, fixtures, players } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Statistics Service - Calculates player and team statistics from recorded match data.
 * 
 * Rules:
 * - Positive stats only (goals, assists, clean sheets, appearances, playing time, MOTM)
 * - Clean sheets: per-quarter attribution (no goals conceded while player was on pitch, min 2 periods)
 * - GK minutes tracked separately from outfield
 * - Season aggregates + per-match records
 * - Leaderboards OK for single-user MVP
 */

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  motmAwards: number;
  outfieldMinutes: number;
  goalkeeperMinutes: number;
  totalMinutes: number;
}

export interface TeamSeasonStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  winPercentage: number;
}

export interface MatchStats {
  fixtureId: string;
  date: string;
  opponent: string | null;
  goalsFor: number;
  goalsAgainst: number;
  result: string | null;
}

export class StatisticsService {
  /**
   * Get season stats for all players.
   */
  async getPlayerSeasonStats(seasonId?: string): Promise<PlayerSeasonStats[]> {
    // Get all active players
    const allPlayers = await db.select().from(players).where(eq(players.isActive, true));

    // Get all completed match fixture IDs for the season
    const completedFixtures = await this.getCompletedMatchFixtures(seasonId);
    const fixtureIds = completedFixtures.map((f) => f.id);

    if (fixtureIds.length === 0) {
      return allPlayers.map((p) => ({
        playerId: p.id,
        playerName: `${p.firstName} ${p.lastName}`,
        appearances: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        motmAwards: 0,
        outfieldMinutes: 0,
        goalkeeperMinutes: 0,
        totalMinutes: 0,
      }));
    }

    // Get all goals
    const allGoals = await db.select().from(goals);
    const matchGoals = allGoals.filter((g) => fixtureIds.includes(g.fixtureId));

    // Get all playing time records
    const allPlayingTime = await db.select().from(playingTime);
    const matchPlayingTime = allPlayingTime.filter((pt) => fixtureIds.includes(pt.fixtureId));

    // Get all match results
    const allResults = await db.select().from(matchResults);
    const matchResultsFiltered = allResults.filter((r) => fixtureIds.includes(r.fixtureId));

    // Get goals against per fixture for clean sheet calculation
    const goalsAgainstMap = new Map<string, number>();
    for (const r of matchResultsFiltered) {
      goalsAgainstMap.set(r.fixtureId, r.goalsAgainst);
    }

    // Calculate per-player stats
    const stats: PlayerSeasonStats[] = allPlayers.map((player) => {
      const playerGoals = matchGoals.filter((g) => g.scorerId === player.id);
      const playerAssists = matchGoals.filter((g) => g.assistId === player.id);
      const playerTime = matchPlayingTime.filter((pt) => pt.playerId === player.id);
      const playerMotm = matchResultsFiltered.filter((r) => r.motmPlayerId === player.id);

      // Appearances: matches where player has a playing time record with > 0 total minutes
      const appearances = playerTime.filter((pt) => pt.totalMinutes > 0).length;

      // Clean sheets: fixtures where goals against = 0 and player played >= 2 periods
      // (Simplified: full-match clean sheet for now; per-quarter attribution is future enhancement)
      let cleanSheets = 0;
      for (const pt of playerTime) {
        if (pt.periodsPlayed + pt.periodsInGoal >= 2) {
          const goalsAgainst = goalsAgainstMap.get(pt.fixtureId) ?? 0;
          if (goalsAgainst === 0) {
            cleanSheets++;
          }
        }
      }

      return {
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        appearances,
        goals: playerGoals.length,
        assists: playerAssists.length,
        cleanSheets,
        motmAwards: playerMotm.length,
        outfieldMinutes: playerTime.reduce((sum, pt) => sum + pt.outfieldMinutes, 0),
        goalkeeperMinutes: playerTime.reduce((sum, pt) => sum + pt.goalkeeperMinutes, 0),
        totalMinutes: playerTime.reduce((sum, pt) => sum + pt.totalMinutes, 0),
      };
    });

    return stats;
  }

  /**
   * Get season stats for a single player.
   */
  async getPlayerStats(playerId: string, seasonId?: string): Promise<PlayerSeasonStats | null> {
    const allStats = await this.getPlayerSeasonStats(seasonId);
    return allStats.find((s) => s.playerId === playerId) ?? null;
  }

  /**
   * Get team season stats.
   */
  async getTeamSeasonStats(seasonId?: string): Promise<TeamSeasonStats> {
    const completedFixtures = await this.getCompletedMatchFixtures(seasonId);
    const fixtureIds = completedFixtures.map((f) => f.id);

    if (fixtureIds.length === 0) {
      return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, cleanSheets: 0, winPercentage: 0 };
    }

    const allResults = await db.select().from(matchResults);
    const results = allResults.filter((r) => fixtureIds.includes(r.fixtureId));

    const won = results.filter((r) => r.result === 'win').length;
    const drawn = results.filter((r) => r.result === 'draw').length;
    const lost = results.filter((r) => r.result === 'loss').length;
    const goalsFor = results.reduce((sum, r) => sum + r.goalsFor, 0);
    const goalsAgainst = results.reduce((sum, r) => sum + r.goalsAgainst, 0);
    const cleanSheets = results.filter((r) => r.goalsAgainst === 0).length;
    const played = results.length;

    return {
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      cleanSheets,
      winPercentage: played > 0 ? Math.round((won / played) * 100) : 0,
    };
  }

  /**
   * Get match-by-match results.
   */
  async getMatchResults(seasonId?: string): Promise<MatchStats[]> {
    const completedFixtures = await this.getCompletedMatchFixtures(seasonId);
    const fixtureIds = completedFixtures.map((f) => f.id);

    const allResults = await db.select().from(matchResults);

    return completedFixtures
      .filter((f) => allResults.some((r) => r.fixtureId === f.id))
      .map((f) => {
        const result = allResults.find((r) => r.fixtureId === f.id)!;
        return {
          fixtureId: f.id,
          date: f.date,
          opponent: f.opponent,
          goalsFor: result.goalsFor,
          goalsAgainst: result.goalsAgainst,
          result: result.result,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Helper: get completed match-type fixtures.
   */
  private async getCompletedMatchFixtures(seasonId?: string) {
    const allFixtures = await db.select().from(fixtures);
    return allFixtures.filter((f) =>
      f.status === 'completed' &&
      f.type !== 'training' &&
      (seasonId ? f.seasonId === seasonId : true)
    );
  }
}

// Singleton instance
export const statisticsService = new StatisticsService();
