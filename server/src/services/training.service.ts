import { trainingRepository, type CreateTrainingSessionData, type UpdateTrainingSessionData, type TrainingSessionRow, type TrainingAttendanceRow, type TrainingBlock } from '../repositories/training.repository.js';

/**
 * Training Service - Business logic for training session management.
 */

type ServiceResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export interface TrainingSessionWithPlan extends TrainingSessionRow {
  parsedObjectives: string[];
  parsedPlan: TrainingBlock[];
}

export class TrainingService {
  async getAllSessions(): Promise<TrainingSessionWithPlan[]> {
    const sessions = await trainingRepository.findAll();
    return sessions.map(this.parseSession);
  }

  async getSessionById(id: string): Promise<ServiceResult<TrainingSessionWithPlan>> {
    const session = await trainingRepository.findById(id);
    if (!session) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Training session not found.' } };
    }
    return { success: true, data: this.parseSession(session) };
  }

  async getSessionByFixture(fixtureId: string): Promise<TrainingSessionWithPlan | null> {
    const session = await trainingRepository.findByFixture(fixtureId);
    return session ? this.parseSession(session) : null;
  }

  async createSession(data: CreateTrainingSessionData): Promise<ServiceResult<TrainingSessionWithPlan>> {
    const session = await trainingRepository.create(data);
    return { success: true, data: this.parseSession(session) };
  }

  async updateSession(id: string, data: UpdateTrainingSessionData): Promise<ServiceResult<TrainingSessionWithPlan>> {
    const updated = await trainingRepository.update(id, data);
    if (!updated) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Training session not found.' } };
    }
    return { success: true, data: this.parseSession(updated) };
  }

  async deleteSession(id: string): Promise<ServiceResult<{ message: string }>> {
    await trainingRepository.delete(id);
    return { success: true, data: { message: 'Training session deleted.' } };
  }

  // === Attendance ===

  async getAttendance(fixtureId: string): Promise<TrainingAttendanceRow[]> {
    return trainingRepository.findAttendanceByFixture(fixtureId);
  }

  async recordAttendance(fixtureId: string, items: { playerId: string; attended: boolean; reason?: string }[]): Promise<ServiceResult<TrainingAttendanceRow[]>> {
    const results = await trainingRepository.batchUpsertAttendance(fixtureId, items);
    return { success: true, data: results };
  }

  // === Helpers ===

  private parseSession(session: TrainingSessionRow): TrainingSessionWithPlan {
    let parsedObjectives: string[] = [];
    let parsedPlan: TrainingBlock[] = [];
    try { parsedObjectives = session.objectives ? JSON.parse(session.objectives) : []; } catch {}
    try { parsedPlan = session.plan ? JSON.parse(session.plan) : []; } catch {}
    return { ...session, parsedObjectives, parsedPlan };
  }
}

export const trainingService = new TrainingService();
