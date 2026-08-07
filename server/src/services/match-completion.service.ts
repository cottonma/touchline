import { db } from '../db/index.js';
import { matchPlans, matchPlanSlots, playingTime, matchResults, goals, fixtures } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Match Completion Service
 * 
 * Calculates actual player minutes from the match plan structure
 * and persists participation records. Idempotent — re-running
 * for the same fixture recalculates rather than duplicating.
 */

export interface PeriodScore {
  period: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface CompleteMatchInput {
  fixtureId: string;
  periodScores: PeriodScore[];
  coachNotes?: string;
  motmPlayerId?: string;
  oppositionNotes?: string;
  goalEntries: { scorerId: string; assistId?: string; period?: number; minute?: number }[];
}

export class MatchCompletionService {
  /**
   * Complete a match: calculate minutes from plan slots and persist everything.
   */
  async completeMatch(input: CompleteMatchInput) {
    const { fixtureId, periodScores, coachNotes, motmPlayerId, goalEntries } = input;

    // 1. Get the match plan and its slots (the actual match structure)
    const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
    if (!plan) {
      return { success: false, error: 'No match plan found for this fixture.' };
    }

    const slots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));

    // 2. Calculate actual minutes per player from the slot structure
    const playerStats = new Map<string, {
      outfieldMinutes: number;
      goalkeeperMinutes: number;
      totalMinutes: number;
      periodsPlayed: number;
      periodsInGoal: number;
      positionsPlayed: Set<string>;
      periodsDetail: { period: number; minutes: number; position: string; isGk: boolean }[];
    }>();

    const periodDuration = Number(plan.periodDurationMinutes);

    for (const slot of slots) {
      const minutes = slot.endMinute - slot.startMinute;
      if (minutes <= 0) continue;

      const existing = playerStats.get(slot.playerId) ?? {
        outfieldMinutes: 0,
        goalkeeperMinutes: 0,
        totalMinutes: 0,
        periodsPlayed: 0,
        periodsInGoal: 0,
        positionsPlayed: new Set<string>(),
        periodsDetail: [],
      };

      if (slot.isGk) {
        existing.goalkeeperMinutes += minutes;
        existing.periodsInGoal++;
      } else {
        existing.outfieldMinutes += minutes;
      }
      existing.totalMinutes += minutes;
      existing.positionsPlayed.add(slot.position);
      existing.periodsDetail.push({
        period: slot.period,
        minutes,
        position: slot.position,
        isGk: slot.isGk,
      });

      // Count unique periods played
      const periodsSet = new Set(existing.periodsDetail.map(d => d.period));
      existing.periodsPlayed = periodsSet.size;

      playerStats.set(slot.playerId, existing);
    }

    // 3. Upsert playing_time records (idempotent)
    const now = new Date().toISOString();
    for (const [playerId, stats] of playerStats) {
      const [existing] = await db.select().from(playingTime)
        .where(and(eq(playingTime.fixtureId, fixtureId), eq(playingTime.playerId, playerId)))
        .limit(1);

      const record = {
        outfieldMinutes: Math.round(stats.outfieldMinutes),
        goalkeeperMinutes: Math.round(stats.goalkeeperMinutes),
        totalMinutes: Math.round(stats.totalMinutes),
        periodsPlayed: stats.periodsPlayed,
        periodsInGoal: stats.periodsInGoal,
        positionsPlayed: JSON.stringify([...stats.positionsPlayed]),
        periodsDetail: JSON.stringify(stats.periodsDetail),
        updatedAt: now,
      };

      if (existing) {
        await db.update(playingTime).set(record).where(eq(playingTime.id, existing.id));
      } else {
        await db.insert(playingTime).values({
          id: nanoid(),
          fixtureId,
          playerId,
          ...record,
          createdAt: now,
        });
      }
    }

    // 4. Calculate final score from period scores
    const goalsFor = periodScores.reduce((sum, p) => sum + p.goalsFor, 0);
    const goalsAgainst = periodScores.reduce((sum, p) => sum + p.goalsAgainst, 0);
    const result = goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';

    // 5. Upsert match result
    const [existingResult] = await db.select().from(matchResults)
      .where(eq(matchResults.fixtureId, fixtureId)).limit(1);

    const resultRecord = {
      goalsFor,
      goalsAgainst,
      result,
      periodScores: JSON.stringify(periodScores),
      coachNotes: coachNotes ?? null,
      motmPlayerId: motmPlayerId ?? null,
      updatedAt: now,
    };

    if (existingResult) {
      await db.update(matchResults).set(resultRecord).where(eq(matchResults.id, existingResult.id));
    } else {
      await db.insert(matchResults).values({
        id: nanoid(),
        fixtureId,
        ...resultRecord,
        createdAt: now,
      });
    }

    // 6. Replace goals (delete existing, insert new)
    const existingGoals = await db.select().from(goals).where(eq(goals.fixtureId, fixtureId));
    for (const g of existingGoals) {
      await db.delete(goals).where(eq(goals.id, g.id));
    }
    for (const goal of goalEntries) {
      if (!goal.scorerId) continue;
      await db.insert(goals).values({
        id: nanoid(),
        fixtureId,
        scorerId: goal.scorerId,
        assistId: goal.assistId ?? null,
        period: goal.period ?? null,
        minute: goal.minute ?? null,
        notes: null,
        createdAt: now,
      });
    }

    // 7. Mark fixture as completed
    await db.update(fixtures).set({ status: 'completed', updatedAt: now }).where(eq(fixtures.id, fixtureId));

    // 8. Update match plan status
    await db.update(matchPlans).set({ status: 'completed', updatedAt: now }).where(eq(matchPlans.id, plan.id));

    return {
      success: true,
      data: {
        goalsFor,
        goalsAgainst,
        result,
        playersRecorded: playerStats.size,
      },
    };
  }
}

export const matchCompletionService = new MatchCompletionService();
