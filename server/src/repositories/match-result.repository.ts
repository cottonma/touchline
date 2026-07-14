import { db } from '../db/index.js';
import { matchResults, goals, playingTime } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Match Result Repository - Data access for post-match recording.
 */

export interface MatchResultRow {
  id: string;
  fixtureId: string;
  goalsFor: number;
  goalsAgainst: number;
  result: string | null;
  coachNotes: string | null;
  motmPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalRow {
  id: string;
  fixtureId: string;
  scorerId: string;
  assistId: string | null;
  minute: number | null;
  period: number | null;
  notes: string | null;
  createdAt: string;
}

export interface PlayingTimeRow {
  id: string;
  fixtureId: string;
  playerId: string;
  outfieldMinutes: number;
  goalkeeperMinutes: number;
  totalMinutes: number;
  periodsPlayed: number;
  periodsInGoal: number;
  createdAt: string;
}

export interface CreateMatchResultData {
  fixtureId: string;
  goalsFor: number;
  goalsAgainst: number;
  coachNotes?: string;
  motmPlayerId?: string;
}

export interface CreateGoalData {
  fixtureId: string;
  scorerId: string;
  assistId?: string;
  minute?: number;
  period?: number;
  notes?: string;
}

export interface CreatePlayingTimeData {
  fixtureId: string;
  playerId: string;
  outfieldMinutes: number;
  goalkeeperMinutes: number;
  totalMinutes: number;
  periodsPlayed: number;
  periodsInGoal: number;
}

export class MatchResultRepository {
  // === Match Results ===

  async findResultByFixture(fixtureId: string): Promise<MatchResultRow | undefined> {
    const results = await db.select().from(matchResults).where(eq(matchResults.fixtureId, fixtureId));
    return results[0];
  }

  async createResult(data: CreateMatchResultData): Promise<MatchResultRow> {
    const now = new Date().toISOString();
    const result: MatchResultRow = {
      id: nanoid(),
      fixtureId: data.fixtureId,
      goalsFor: data.goalsFor,
      goalsAgainst: data.goalsAgainst,
      result: data.goalsFor > data.goalsAgainst ? 'win' : data.goalsFor < data.goalsAgainst ? 'loss' : 'draw',
      coachNotes: data.coachNotes ?? null,
      motmPlayerId: data.motmPlayerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(matchResults).values(result);
    return result;
  }

  async updateResult(fixtureId: string, data: Partial<CreateMatchResultData>): Promise<MatchResultRow | undefined> {
    const existing = await this.findResultByFixture(fixtureId);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const goalsFor = data.goalsFor ?? existing.goalsFor;
    const goalsAgainst = data.goalsAgainst ?? existing.goalsAgainst;

    const updated: MatchResultRow = {
      ...existing,
      goalsFor,
      goalsAgainst,
      result: goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw',
      coachNotes: data.coachNotes !== undefined ? (data.coachNotes ?? null) : existing.coachNotes,
      motmPlayerId: data.motmPlayerId !== undefined ? (data.motmPlayerId ?? null) : existing.motmPlayerId,
      updatedAt: now,
    };

    await db.update(matchResults).set(updated).where(eq(matchResults.id, existing.id));
    return updated;
  }

  // === Goals ===

  async findGoalsByFixture(fixtureId: string): Promise<GoalRow[]> {
    return db.select().from(goals).where(eq(goals.fixtureId, fixtureId));
  }

  async createGoal(data: CreateGoalData): Promise<GoalRow> {
    const now = new Date().toISOString();
    const goal: GoalRow = {
      id: nanoid(),
      fixtureId: data.fixtureId,
      scorerId: data.scorerId,
      assistId: data.assistId ?? null,
      minute: data.minute ?? null,
      period: data.period ?? null,
      notes: data.notes ?? null,
      createdAt: now,
    };
    await db.insert(goals).values(goal);
    return goal;
  }

  async deleteGoal(id: string): Promise<boolean> {
    const result = await db.delete(goals).where(eq(goals.id, id));
    return true;
  }

  async deleteGoalsByFixture(fixtureId: string): Promise<void> {
    await db.delete(goals).where(eq(goals.fixtureId, fixtureId));
  }

  // === Playing Time ===

  async findPlayingTimeByFixture(fixtureId: string): Promise<PlayingTimeRow[]> {
    return db.select().from(playingTime).where(eq(playingTime.fixtureId, fixtureId));
  }

  async upsertPlayingTime(data: CreatePlayingTimeData): Promise<PlayingTimeRow> {
    const now = new Date().toISOString();
    
    // Check existing
    const existing = await db.select().from(playingTime)
      .where(eq(playingTime.fixtureId, data.fixtureId));
    const existingRecord = existing.find((r) => r.playerId === data.playerId);

    if (existingRecord) {
      const updated: PlayingTimeRow = {
        ...existingRecord,
        outfieldMinutes: data.outfieldMinutes,
        goalkeeperMinutes: data.goalkeeperMinutes,
        totalMinutes: data.totalMinutes,
        periodsPlayed: data.periodsPlayed,
        periodsInGoal: data.periodsInGoal,
        createdAt: existingRecord.createdAt,
      };
      await db.update(playingTime).set(updated).where(eq(playingTime.id, existingRecord.id));
      return updated;
    }

    const record: PlayingTimeRow = {
      id: nanoid(),
      fixtureId: data.fixtureId,
      playerId: data.playerId,
      outfieldMinutes: data.outfieldMinutes,
      goalkeeperMinutes: data.goalkeeperMinutes,
      totalMinutes: data.totalMinutes,
      periodsPlayed: data.periodsPlayed,
      periodsInGoal: data.periodsInGoal,
      createdAt: now,
    };
    await db.insert(playingTime).values(record);
    return record;
  }

  async batchUpsertPlayingTime(items: CreatePlayingTimeData[]): Promise<PlayingTimeRow[]> {
    const results: PlayingTimeRow[] = [];
    for (const item of items) {
      results.push(await this.upsertPlayingTime(item));
    }
    return results;
  }

  async deletePlayingTimeByFixture(fixtureId: string): Promise<void> {
    await db.delete(playingTime).where(eq(playingTime.fixtureId, fixtureId));
  }
}

// Singleton instance
export const matchResultRepository = new MatchResultRepository();
