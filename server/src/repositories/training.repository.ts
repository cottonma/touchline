import { db } from '../db/index.js';
import { trainingSessions, trainingAttendance, fixtures } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Training Repository - Data access for training session planning and attendance.
 */

export interface TrainingSessionRow {
  id: string;
  fixtureId: string | null;
  theme: string | null;
  objectives: string | null; // JSON array
  plan: string | null; // JSON structured plan (array of blocks)
  notes: string | null;
  linkedFixtureId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingAttendanceRow {
  id: string;
  fixtureId: string;
  playerId: string;
  attended: boolean;
  reason: string | null;
}

export interface CreateTrainingSessionData {
  fixtureId?: string;
  theme?: string;
  objectives?: string[];
  plan?: TrainingBlock[];
  notes?: string;
  linkedFixtureId?: string;
}

export interface TrainingBlock {
  type: string; // warm_up, technical_drill, tactical_drill, small_sided_game, match, cool_down, discussion
  title: string;
  duration: number; // minutes
  description?: string;
  equipment?: string;
  coachingPoints?: string;
}

export interface UpdateTrainingSessionData extends Partial<CreateTrainingSessionData> {}

export class TrainingRepository {
  async findAll(): Promise<TrainingSessionRow[]> {
    return db.select().from(trainingSessions).orderBy(trainingSessions.createdAt);
  }

  async findById(id: string): Promise<TrainingSessionRow | undefined> {
    const results = await db.select().from(trainingSessions).where(eq(trainingSessions.id, id));
    return results[0];
  }

  async findByFixture(fixtureId: string): Promise<TrainingSessionRow | undefined> {
    const results = await db.select().from(trainingSessions).where(eq(trainingSessions.fixtureId, fixtureId));
    return results[0];
  }

  async create(data: CreateTrainingSessionData): Promise<TrainingSessionRow> {
    const now = new Date().toISOString();
    const session: TrainingSessionRow = {
      id: nanoid(),
      fixtureId: data.fixtureId ?? null,
      theme: data.theme ?? null,
      objectives: data.objectives ? JSON.stringify(data.objectives) : null,
      plan: data.plan ? JSON.stringify(data.plan) : null,
      notes: data.notes ?? null,
      linkedFixtureId: data.linkedFixtureId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(trainingSessions).values(session);
    return session;
  }

  async update(id: string, data: UpdateTrainingSessionData): Promise<TrainingSessionRow | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const updated: TrainingSessionRow = {
      ...existing,
      theme: data.theme !== undefined ? (data.theme ?? null) : existing.theme,
      objectives: data.objectives !== undefined ? (data.objectives ? JSON.stringify(data.objectives) : null) : existing.objectives,
      plan: data.plan !== undefined ? (data.plan ? JSON.stringify(data.plan) : null) : existing.plan,
      notes: data.notes !== undefined ? (data.notes ?? null) : existing.notes,
      linkedFixtureId: data.linkedFixtureId !== undefined ? (data.linkedFixtureId ?? null) : existing.linkedFixtureId,
      updatedAt: now,
    };
    await db.update(trainingSessions).set(updated).where(eq(trainingSessions.id, id));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await db.delete(trainingSessions).where(eq(trainingSessions.id, id));
    return true;
  }

  // === Attendance ===

  async findAttendanceByFixture(fixtureId: string): Promise<TrainingAttendanceRow[]> {
    return db.select().from(trainingAttendance).where(eq(trainingAttendance.fixtureId, fixtureId));
  }

  async upsertAttendance(fixtureId: string, playerId: string, attended: boolean, reason?: string): Promise<TrainingAttendanceRow> {
    const existing = await db.select().from(trainingAttendance)
      .where(eq(trainingAttendance.fixtureId, fixtureId));
    const record = existing.find((r) => r.playerId === playerId);

    if (record) {
      const updated = { ...record, attended, reason: reason ?? record.reason };
      await db.update(trainingAttendance).set(updated).where(eq(trainingAttendance.id, record.id));
      return updated;
    }

    const newRecord: TrainingAttendanceRow = {
      id: nanoid(),
      fixtureId,
      playerId,
      attended,
      reason: reason ?? null,
    };
    await db.insert(trainingAttendance).values(newRecord);
    return newRecord;
  }

  async batchUpsertAttendance(fixtureId: string, items: { playerId: string; attended: boolean; reason?: string }[]): Promise<TrainingAttendanceRow[]> {
    const results: TrainingAttendanceRow[] = [];
    for (const item of items) {
      results.push(await this.upsertAttendance(fixtureId, item.playerId, item.attended, item.reason));
    }
    return results;
  }
}

export const trainingRepository = new TrainingRepository();
