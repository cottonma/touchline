import { matchResultRepository, type CreateMatchResultData, type CreateGoalData, type CreatePlayingTimeData } from '../repositories/match-result.repository.js';
import { fixtureRepository } from '../repositories/fixture.repository.js';

/**
 * Match Day Service - Business logic for post-match recording.
 * 
 * Flow:
 * 1. Coach generates team selection (pre-match plan)
 * 2. Match happens
 * 3. Coach records: score, goals/assists, playing time (adjusting from plan), notes, MOTM
 * 4. Playing time is pre-filled from the plan, coach edits exceptions
 */

export interface MatchDayServiceError {
  code: string;
  message: string;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: MatchDayServiceError };

export interface RecordMatchInput {
  fixtureId: string;
  goalsFor: number;
  goalsAgainst: number;
  coachNotes?: string;
  motmPlayerId?: string;
  goals: CreateGoalData[];
  playingTime: CreatePlayingTimeData[];
}

export interface MatchDayRecord {
  result: Awaited<ReturnType<typeof matchResultRepository.findResultByFixture>> | null;
  goals: Awaited<ReturnType<typeof matchResultRepository.findGoalsByFixture>>;
  playingTime: Awaited<ReturnType<typeof matchResultRepository.findPlayingTimeByFixture>>;
}

export class MatchDayService {
  /**
   * Get existing match day record for a fixture.
   */
  async getMatchDayRecord(fixtureId: string): Promise<ServiceResult<MatchDayRecord>> {
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return { success: false, error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' } };
    }

    const result = await matchResultRepository.findResultByFixture(fixtureId);
    const goals = await matchResultRepository.findGoalsByFixture(fixtureId);
    const playingTimeRecords = await matchResultRepository.findPlayingTimeByFixture(fixtureId);

    return {
      success: true,
      data: { result: result ?? null, goals, playingTime: playingTimeRecords },
    };
  }

  /**
   * Record a full match result.
   * This is the main post-match submission that saves everything at once.
   */
  async recordMatch(input: RecordMatchInput): Promise<ServiceResult<MatchDayRecord>> {
    const fixture = await fixtureRepository.findById(input.fixtureId);
    if (!fixture) {
      return { success: false, error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' } };
    }

    if (fixture.type === 'training') {
      return { success: false, error: { code: 'NOT_A_MATCH', message: 'Cannot record match results for training sessions.' } };
    }

    // Check if result already exists (update vs create)
    const existing = await matchResultRepository.findResultByFixture(input.fixtureId);

    let result;
    if (existing) {
      result = await matchResultRepository.updateResult(input.fixtureId, {
        goalsFor: input.goalsFor,
        goalsAgainst: input.goalsAgainst,
        coachNotes: input.coachNotes,
        motmPlayerId: input.motmPlayerId,
      });
    } else {
      result = await matchResultRepository.createResult({
        fixtureId: input.fixtureId,
        goalsFor: input.goalsFor,
        goalsAgainst: input.goalsAgainst,
        coachNotes: input.coachNotes,
        motmPlayerId: input.motmPlayerId,
      });
    }

    // Replace goals (delete existing, insert new)
    await matchResultRepository.deleteGoalsByFixture(input.fixtureId);
    for (const goal of input.goals) {
      await matchResultRepository.createGoal({ ...goal, fixtureId: input.fixtureId });
    }

    // Upsert playing time records
    await matchResultRepository.batchUpsertPlayingTime(input.playingTime);

    // Mark fixture as completed
    await fixtureRepository.update(input.fixtureId, { status: 'completed' });

    // Return the full record
    const savedGoals = await matchResultRepository.findGoalsByFixture(input.fixtureId);
    const savedPlayingTime = await matchResultRepository.findPlayingTimeByFixture(input.fixtureId);

    return {
      success: true,
      data: { result: result ?? null, goals: savedGoals, playingTime: savedPlayingTime },
    };
  }
}

// Singleton instance
export const matchDayService = new MatchDayService();
