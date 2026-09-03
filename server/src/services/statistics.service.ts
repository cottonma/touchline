import { db } from '../db/index.js';
import { goals, playingTime, matchResults, fixtures, players, seasons, matchPlans } from '../db/schema.js';
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
  // Derived metrics
  goalInvolvements: number;        // goals + assists
  minutesPerGoal: number | null;   // total minutes / goals (null if no goals)
  minutesPerAssist: number | null; // total minutes / assists (null if no assists)
  avgMinutesPerAppearance: number; // total minutes / appearances
  positionsPlayed: string[];       // distinct positions across the season
  positionVariety: number;         // count of distinct positions
  gkSharePct: number;              // % of minutes spent in goal
  periodsPlayed: number;           // total periods featured (outfield + in goal)
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
  periods: number; // period structure of the active season (2 halves / 4 quarters)
}

export interface MatchStats {
  fixtureId: string;
  date: string;
  opponent: string | null;
  homeAway: string | null;
  goalsFor: number;
  goalsAgainst: number;
  result: string | null;
}

export class StatisticsService {
  /**
   * Get season stats for all players.
   */
  async getPlayerSeasonStats(seasonId?: string, clubId?: string): Promise<PlayerSeasonStats[]> {
    // Get active players scoped to the club
    const allPlayers = await this.getActivePlayers(clubId);

    // Get all completed match fixture IDs for the club's active season
    const completedFixtures = await this.getCompletedMatchFixtures(seasonId, clubId);
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

    // Get match plans (for per-period duration) for these fixtures
    const allPlans = await db.select().from(matchPlans);
    const planByFixture = new Map<string, typeof allPlans[number]>();
    for (const p of allPlans) planByFixture.set(p.fixtureId, p);

    // Build, per fixture, the set of periods where the opponent did NOT score
    // (clean-sheet periods) plus that fixture's full-period duration.
    const cleanSheetPeriodsByFixture = new Map<string, Set<number>>();
    const periodDurationByFixture = new Map<string, number>();
    for (const r of matchResultsFiltered) {
      const cleanPeriods = new Set<number>();
      if (r.periodScores) {
        try {
          const scores = JSON.parse(r.periodScores) as { period: number; goalsFor: number; goalsAgainst: number }[];
          for (const ps of scores) {
            if ((ps.goalsAgainst ?? 0) === 0) cleanPeriods.add(ps.period);
          }
        } catch {
          // No usable per-period breakdown for this fixture
        }
      }
      cleanSheetPeriodsByFixture.set(r.fixtureId, cleanPeriods);
      const plan = planByFixture.get(r.fixtureId);
      periodDurationByFixture.set(r.fixtureId, Number(plan?.periodDurationMinutes ?? 0));
    }

    // Calculate per-player stats
    const stats: PlayerSeasonStats[] = allPlayers.map((player) => {
      const playerGoals = matchGoals.filter((g) => g.scorerId === player.id);
      const playerAssists = matchGoals.filter((g) => g.assistId === player.id);
      const playerTime = matchPlayingTime.filter((pt) => pt.playerId === player.id);
      const playerMotm = matchResultsFiltered.filter((r) => r.motmPlayerId === player.id);

      // Appearances: matches where player has a playing time record with > 0 total minutes
      const appearances = playerTime.filter((pt) => pt.totalMinutes > 0).length;

      // Clean sheet periods (quarters/halves): count each period where the
      // opponent did not score AND the player was on the pitch for the FULL
      // period. Applies to both goalkeepers and outfield players.
      let cleanSheets = 0;
      for (const pt of playerTime) {
        const cleanPeriods = cleanSheetPeriodsByFixture.get(pt.fixtureId);
        if (!cleanPeriods || cleanPeriods.size === 0) continue;
        const periodDuration = periodDurationByFixture.get(pt.fixtureId) ?? 0;
        if (!pt.periodsDetail) continue;
        let detail: { period: number; minutes: number; position: string; isGk: boolean }[] = [];
        try { detail = JSON.parse(pt.periodsDetail); } catch { continue; }

        // Sum minutes this player was on the pitch in each period (a player may
        // appear more than once in a period if subbed within it).
        const minutesByPeriod = new Map<number, number>();
        for (const d of detail) {
          minutesByPeriod.set(d.period, (minutesByPeriod.get(d.period) ?? 0) + (d.minutes ?? 0));
        }

        for (const period of cleanPeriods) {
          const played = minutesByPeriod.get(period) ?? 0;
          // Must have played the FULL period to earn the clean-sheet period
          if (periodDuration > 0 && played >= periodDuration) {
            cleanSheets++;
          }
        }
      }

      const goalCount = playerGoals.length;
      const assistCount = playerAssists.length;
      const outfieldMinutes = playerTime.reduce((sum, pt) => sum + pt.outfieldMinutes, 0);
      const goalkeeperMinutes = playerTime.reduce((sum, pt) => sum + pt.goalkeeperMinutes, 0);
      const totalMinutes = playerTime.reduce((sum, pt) => sum + pt.totalMinutes, 0);
      const periodsPlayed = playerTime.reduce((sum, pt) => sum + pt.periodsPlayed + pt.periodsInGoal, 0);

      // Distinct positions across the season (from each match's positionsPlayed JSON)
      const positionSet = new Set<string>();
      for (const pt of playerTime) {
        if (!pt.positionsPlayed) continue;
        try {
          const positions = JSON.parse(pt.positionsPlayed) as string[];
          for (const pos of positions) if (pos) positionSet.add(pos);
        } catch { /* ignore malformed */ }
      }
      const positionsPlayed = [...positionSet];

      return {
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        appearances,
        goals: goalCount,
        assists: assistCount,
        cleanSheets,
        motmAwards: playerMotm.length,
        outfieldMinutes,
        goalkeeperMinutes,
        totalMinutes,
        // Derived metrics
        goalInvolvements: goalCount + assistCount,
        // Rate based on OUTFIELD minutes only — a player can't score/assist while in goal
        minutesPerGoal: goalCount > 0 ? Math.round(outfieldMinutes / goalCount) : null,
        minutesPerAssist: assistCount > 0 ? Math.round(outfieldMinutes / assistCount) : null,
        avgMinutesPerAppearance: appearances > 0 ? Math.round(totalMinutes / appearances) : 0,
        positionsPlayed,
        positionVariety: positionsPlayed.length,
        gkSharePct: totalMinutes > 0 ? Math.round((goalkeeperMinutes / totalMinutes) * 100) : 0,
        periodsPlayed,
      };
    });

    return stats;
  }

  /**
   * Get season stats for a single player.
   */
  async getPlayerStats(playerId: string, seasonId?: string, clubId?: string): Promise<PlayerSeasonStats | null> {
    const allStats = await this.getPlayerSeasonStats(seasonId, clubId);
    return allStats.find((s) => s.playerId === playerId) ?? null;
  }

  /**
   * Get team season stats.
   */
  async getTeamSeasonStats(seasonId?: string, clubId?: string): Promise<TeamSeasonStats> {
    const periods = await this.getSeasonPeriods(seasonId, clubId);
    const completedFixtures = await this.getCompletedMatchFixtures(seasonId, clubId);
    const fixtureIds = completedFixtures.map((f) => f.id);

    if (fixtureIds.length === 0) {
      return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, cleanSheets: 0, winPercentage: 0, periods };
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
      periods,
    };
  }

  /**
   * Resolve the period structure (2 halves / 4 quarters) for the active season.
   */
  private async getSeasonPeriods(seasonId?: string, clubId?: string): Promise<number> {
    let sid = seasonId;
    if (!sid && clubId) sid = await this.getActiveSeasonId(clubId);
    if (!sid) return 4; // sensible default (quarters)
    const [season] = await db.select().from(seasons).where(eq(seasons.id, sid)).limit(1);
    return season?.periods ?? 4;
  }

  /**
   * Get match-by-match results.
   */
  async getMatchResults(seasonId?: string, clubId?: string): Promise<MatchStats[]> {
    const completedFixtures = await this.getCompletedMatchFixtures(seasonId, clubId);
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
          homeAway: f.homeAway,
          goalsFor: result.goalsFor,
          goalsAgainst: result.goalsAgainst,
          result: result.result,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Helper: get completed match-type fixtures.
   * If a clubId is provided, scope to that club's active season (unless an
   * explicit seasonId is given). Fixtures link to a club via their season.
   */
  private async getCompletedMatchFixtures(seasonId?: string, clubId?: string) {
    const effectiveSeasonId = seasonId ?? (clubId ? await this.getActiveSeasonId(clubId) : undefined);
    const allFixtures = await db.select().from(fixtures);
    return allFixtures.filter((f) =>
      f.status === 'completed' &&
      f.type !== 'training' &&
      (effectiveSeasonId ? f.seasonId === effectiveSeasonId : true)
    );
  }

  /**
   * Resolve the active season id for a club (falls back to most recent).
   */
  private async getActiveSeasonId(clubId: string): Promise<string | undefined> {
    const clubSeasons = await db.select().from(seasons).where(eq(seasons.clubId, clubId));
    if (clubSeasons.length === 0) return undefined;
    const active = clubSeasons.find((s) => s.isActive);
    if (active) return active.id;
    return [...clubSeasons].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0]?.id;
  }

  /**
   * Active players scoped to a club.
   */
  private async getActivePlayers(clubId?: string) {
    const conditions = [eq(players.isActive, true)];
    if (clubId) conditions.push(eq(players.clubId, clubId));
    return db.select().from(players).where(and(...conditions));
  }
}

// Singleton instance
export const statisticsService = new StatisticsService();
