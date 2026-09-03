import { db } from '../db/index.js';
import { players, fixtures, playingTime, matchResults, goals, trainingAttendance, developmentGoals, seasons } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Reports Service - Generates structured report data for:
 * 1. Season Playing Time Summary
 * 2. Attendance Report (matches + training)
 * 3. Individual Player Report Card
 * 4. Season Results Summary
 * 5. Development Progress Report
 * 6. GK Rotation Report
 * 7. Position Variety Report
 * 
 * Reports return structured data that can be displayed in UI or exported to PDF.
 */

export interface PlayingTimeSummaryReport {
  title: string;
  generatedAt: string;
  players: {
    name: string;
    outfieldMinutes: number;
    gkMinutes: number;
    totalMinutes: number;
    appearances: number;
    percentageOfAvailableTime: number;
  }[];
  totals: {
    totalMatchMinutes: number;
    averagePerPlayer: number;
  };
}

export interface AttendanceReport {
  title: string;
  generatedAt: string;
  players: {
    name: string;
    matchesAvailable: number;
    matchesPlayed: number;
    trainingSessions: number;
    trainingAttended: number;
    matchAttendanceRate: number;
    trainingAttendanceRate: number;
  }[];
}

export interface PlayerReportCard {
  title: string;
  generatedAt: string;
  player: {
    name: string;
    shirtNumber: number | null;
    position: string;
    preferredFoot: string | null;
  };
  stats: {
    appearances: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    motmAwards: number;
    outfieldMinutes: number;
    gkMinutes: number;
  };
  development: {
    totalGoals: number;
    achieved: number;
    improving: number;
    workingOnIt: number;
  };
}

export interface SeasonResultsReport {
  title: string;
  generatedAt: string;
  summary: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    cleanSheets: number;
    winPercentage: number;
  };
  results: {
    date: string;
    opponent: string | null;
    goalsFor: number;
    goalsAgainst: number;
    result: string | null;
  }[];
}

export interface GkRotationReport {
  title: string;
  generatedAt: string;
  volunteers: {
    name: string;
    totalGkMinutes: number;
    matchesInGoal: number;
    periodsInGoal: number;
  }[];
}

export interface DevelopmentProgressReport {
  title: string;
  generatedAt: string;
  players: {
    name: string;
    totalGoals: number;
    achieved: number;
    improving: number;
    workingOnIt: number;
    goals: { title: string; category: string; status: string }[];
  }[];
}

export class ReportsService {
  /**
   * Season Playing Time Summary
   */
  async getPlayingTimeSummary(clubId?: string): Promise<PlayingTimeSummaryReport> {
    const allPlayers = await this.getActivePlayers(clubId);
    const allPlayingTime = await db.select().from(playingTime);
    const completedFixtures = await this.getCompletedMatchFixtures(clubId);
    const completedFixtureIds = new Set(completedFixtures.map(f => f.id));

    const playerData = allPlayers.map((p) => {
      const pt = allPlayingTime.filter((r) => r.playerId === p.id && completedFixtureIds.has(r.fixtureId));
      const outfieldMinutes = pt.reduce((sum, r) => sum + r.outfieldMinutes, 0);
      const gkMinutes = pt.reduce((sum, r) => sum + r.goalkeeperMinutes, 0);
      const totalMinutes = pt.reduce((sum, r) => sum + r.totalMinutes, 0);
      const appearances = pt.filter((r) => r.totalMinutes > 0).length;
      const maxPossible = completedFixtures.length * 48; // approximate
      const percentage = maxPossible > 0 ? Math.round((totalMinutes / maxPossible) * 100) : 0;

      return {
        name: `${p.firstName} ${p.lastName}`,
        outfieldMinutes,
        gkMinutes,
        totalMinutes,
        appearances,
        percentageOfAvailableTime: percentage,
      };
    }).sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalMatchMinutes = playerData.reduce((sum, p) => sum + p.totalMinutes, 0);

    return {
      title: 'Season Playing Time Summary',
      generatedAt: new Date().toISOString(),
      players: playerData,
      totals: {
        totalMatchMinutes,
        averagePerPlayer: allPlayers.length > 0 ? Math.round(totalMatchMinutes / allPlayers.length) : 0,
      },
    };
  }

  /**
   * Attendance Report (matches + training)
   */
  async getAttendanceReport(clubId?: string): Promise<AttendanceReport> {
    const allPlayers = await this.getActivePlayers(clubId);
    const allPlayingTime = await db.select().from(playingTime);
    const allTrainingAttendance = await db.select().from(trainingAttendance);
    const completedMatches = await this.getCompletedMatchFixtures(clubId);
    const trainingFixtures = await this.getClubFixtures(clubId).then((fx) => fx.filter((f) => f.type === 'training'));

    const completedFixtureIds = new Set(completedMatches.map(f => f.id));

    const playerData = allPlayers.map((p) => {
      // Only count playing time for fixtures that still exist as completed matches
      const matchesPlayed = allPlayingTime.filter((pt) => pt.playerId === p.id && pt.totalMinutes > 0 && completedFixtureIds.has(pt.fixtureId)).length;
      const trainingRecords = allTrainingAttendance.filter((ta) => ta.playerId === p.id);
      const trainingAttended = trainingRecords.filter((ta) => ta.attended).length;
      const matchAttendanceRate = completedMatches.length > 0 ? Math.round((matchesPlayed / completedMatches.length) * 100) : 0;
      const trainingRate = trainingFixtures.length > 0 ? Math.round((trainingAttended / trainingFixtures.length) * 100) : 0;

      return {
        name: `${p.firstName} ${p.lastName}`,
        matchesAvailable: completedMatches.length,
        matchesPlayed,
        trainingSessions: trainingFixtures.length,
        trainingAttended,
        matchAttendanceRate,
        trainingAttendanceRate: trainingRate,
      };
    }).sort((a, b) => b.matchAttendanceRate - a.matchAttendanceRate);

    return {
      title: 'Attendance Report',
      generatedAt: new Date().toISOString(),
      players: playerData,
    };
  }

  /**
   * Individual Player Report Card
   */
  async getPlayerReportCard(playerId: string, clubId?: string): Promise<PlayerReportCard | null> {
    const allPlayers = await db.select().from(players).where(eq(players.id, playerId));
    const player = allPlayers[0];
    if (!player) return null;
    // If a club is selected, don't return players from other clubs
    if (clubId && player.clubId && player.clubId !== clubId) return null;

    const completedFixtures = await this.getCompletedMatchFixtures(clubId);
    const fixtureIds = completedFixtures.map((f) => f.id);
    const completedFixtureIdSet = new Set(fixtureIds);

    const allPlayingTime = await db.select().from(playingTime);
    // Only count playing time for fixtures that still exist
    const pt = allPlayingTime.filter((r) => r.playerId === playerId && completedFixtureIdSet.has(r.fixtureId));
    const allGoals = await db.select().from(goals);
    const playerGoals = allGoals.filter((g) => g.scorerId === playerId && completedFixtureIdSet.has(g.fixtureId));
    const playerAssists = allGoals.filter((g) => g.assistId === playerId && completedFixtureIdSet.has(g.fixtureId));
    const allResults = await db.select().from(matchResults);
    const motmCount = allResults.filter((r) => r.motmPlayerId === playerId && completedFixtureIdSet.has(r.fixtureId)).length;
    let cleanSheets = 0;
    for (const record of pt) {
      if (fixtureIds.includes(record.fixtureId) && record.periodsPlayed + record.periodsInGoal >= 2) {
        const result = allResults.find((r) => r.fixtureId === record.fixtureId);
        if (result && result.goalsAgainst === 0) cleanSheets++;
      }
    }

    // Development goals
    const devGoals = await db.select().from(developmentGoals).where(eq(developmentGoals.playerId, playerId));
    const achieved = devGoals.filter((g) => g.status === 'achieved').length;
    const improving = devGoals.filter((g) => g.status === 'improving').length;
    const workingOnIt = devGoals.filter((g) => g.status === 'working_on_it').length;

    return {
      title: `Player Report: ${player.firstName} ${player.lastName}`,
      generatedAt: new Date().toISOString(),
      player: {
        name: `${player.firstName} ${player.lastName}`,
        shirtNumber: player.shirtNumber,
        position: player.primaryPosition,
        preferredFoot: player.preferredFoot,
      },
      stats: {
        appearances: pt.filter((r) => r.totalMinutes > 0).length,
        goals: playerGoals.length,
        assists: playerAssists.length,
        cleanSheets,
        motmAwards: motmCount,
        outfieldMinutes: pt.reduce((sum, r) => sum + r.outfieldMinutes, 0),
        gkMinutes: pt.reduce((sum, r) => sum + r.goalkeeperMinutes, 0),
      },
      development: { totalGoals: devGoals.length, achieved, improving, workingOnIt },
    };
  }

  /**
   * Season Results Summary
   */
  async getSeasonResults(clubId?: string): Promise<SeasonResultsReport> {
    const completedFixtures = await this.getCompletedMatchFixtures(clubId);
    const allResults = await db.select().from(matchResults);
    const fixtureIds = completedFixtures.map((f) => f.id);
    const results = allResults.filter((r) => fixtureIds.includes(r.fixtureId));

    const won = results.filter((r) => r.result === 'win').length;
    const drawn = results.filter((r) => r.result === 'draw').length;
    const lost = results.filter((r) => r.result === 'loss').length;
    const goalsFor = results.reduce((sum, r) => sum + r.goalsFor, 0);
    const goalsAgainst = results.reduce((sum, r) => sum + r.goalsAgainst, 0);
    const cleanSheets = results.filter((r) => r.goalsAgainst === 0).length;
    const played = results.length;

    const matchResults2 = completedFixtures.map((f) => {
      const r = results.find((res) => res.fixtureId === f.id);
      return {
        date: f.date,
        opponent: f.opponent,
        goalsFor: r?.goalsFor ?? 0,
        goalsAgainst: r?.goalsAgainst ?? 0,
        result: r?.result ?? null,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    return {
      title: 'Season Results Summary',
      generatedAt: new Date().toISOString(),
      summary: {
        played, won, drawn, lost, goalsFor, goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        cleanSheets,
        winPercentage: played > 0 ? Math.round((won / played) * 100) : 0,
      },
      results: matchResults2,
    };
  }

  /**
   * GK Rotation Report
   */
  async getGkRotationReport(clubId?: string): Promise<GkRotationReport> {
    const allPlayers = await this.getActivePlayers(clubId);
    const gkVolunteers = allPlayers.filter((p) => p.isGkVolunteer);
    const allPlayingTime = await db.select().from(playingTime);
    const completedFixtures = await this.getCompletedMatchFixtures(clubId);
    const completedFixtureIds = new Set(completedFixtures.map(f => f.id));

    const volunteers = gkVolunteers.map((p) => {
      const pt = allPlayingTime.filter((r) => r.playerId === p.id && r.goalkeeperMinutes > 0 && completedFixtureIds.has(r.fixtureId));
      return {
        name: `${p.firstName} ${p.lastName}`,
        totalGkMinutes: pt.reduce((sum, r) => sum + r.goalkeeperMinutes, 0),
        matchesInGoal: pt.length,
        periodsInGoal: pt.reduce((sum, r) => sum + r.periodsInGoal, 0),
      };
    }).sort((a, b) => b.totalGkMinutes - a.totalGkMinutes);

    return {
      title: 'Goalkeeper Rotation Report',
      generatedAt: new Date().toISOString(),
      volunteers,
    };
  }

  /**
   * Development Progress Report
   */
  async getDevelopmentProgressReport(clubId?: string): Promise<DevelopmentProgressReport> {
    const allPlayers = await this.getActivePlayers(clubId);
    const allDevGoals = await db.select().from(developmentGoals);

    const playerData = allPlayers
      .map((p) => {
        const playerGoals = allDevGoals.filter((g) => g.playerId === p.id);
        return {
          name: `${p.firstName} ${p.lastName}`,
          totalGoals: playerGoals.length,
          achieved: playerGoals.filter((g) => g.status === 'achieved').length,
          improving: playerGoals.filter((g) => g.status === 'improving').length,
          workingOnIt: playerGoals.filter((g) => g.status === 'working_on_it').length,
          goals: playerGoals.map((g) => ({ title: g.title, category: g.category, status: g.status })),
        };
      })
      .filter((p) => p.totalGoals > 0)
      .sort((a, b) => b.achieved - a.achieved);

    return {
      title: 'Development Progress Report',
      generatedAt: new Date().toISOString(),
      players: playerData,
    };
  }

  // === Helpers ===

  /**
   * Resolve the active season id for a club. Falls back to the club's most
   * recent season if none is explicitly marked active.
   */
  private async getActiveSeasonId(clubId: string): Promise<string | undefined> {
    const clubSeasons = await db.select().from(seasons).where(eq(seasons.clubId, clubId));
    if (clubSeasons.length === 0) return undefined;
    const active = clubSeasons.find((s) => s.isActive);
    if (active) return active.id;
    // No active flag set — use the most recently started season
    return [...clubSeasons].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0]?.id;
  }

  /**
   * Completed match fixtures for a club's active season.
   * Excludes training, and only includes fixtures marked completed
   * (upcoming/scheduled fixtures are never counted).
   */
  private async getCompletedMatchFixtures(clubId?: string) {
    const fixtures = await this.getClubFixtures(clubId);
    return fixtures.filter((f) => f.status === 'completed' && f.type !== 'training');
  }

  /**
   * All fixtures for a club's active season (any status/type).
   */
  private async getClubFixtures(clubId?: string) {
    if (!clubId) return db.select().from(fixtures);
    const seasonId = await this.getActiveSeasonId(clubId);
    if (!seasonId) return [];
    return db.select().from(fixtures).where(eq(fixtures.seasonId, seasonId));
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

export const reportsService = new ReportsService();
