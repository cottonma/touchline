import { db } from '../db/index.js';
import { developmentGoals, developmentObservations, developmentGoalLibrary } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Development Repository - Data access for player development goals and observations.
 */

export interface DevelopmentGoalRow {
  id: string;
  playerId: string;
  seasonId: string | null;
  category: string;
  positionGroup: string;
  title: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentObservationRow {
  id: string;
  goalId: string | null;
  playerId: string;
  fixtureId: string | null;
  observation: string;
  observedAt: string;
  createdAt: string;
}

export interface GoalLibraryRow {
  id: string;
  category: string;
  positionGroup: string;
  title: string;
  description: string | null;
  isCustom: boolean;
  createdAt: string;
}

export interface CreateGoalData {
  playerId: string;
  seasonId?: string;
  category: string;
  positionGroup: string;
  title: string;
  description?: string;
  targetDate?: string;
}

export interface CreateObservationData {
  goalId?: string;
  playerId: string;
  fixtureId?: string;
  observation: string;
  observedAt: string;
}

export class DevelopmentRepository {
  // === Goals ===

  async findGoalsByPlayer(playerId: string): Promise<DevelopmentGoalRow[]> {
    return db.select().from(developmentGoals)
      .where(eq(developmentGoals.playerId, playerId))
      .orderBy(developmentGoals.createdAt);
  }

  async findActiveGoalsByPlayer(playerId: string): Promise<DevelopmentGoalRow[]> {
    const all = await this.findGoalsByPlayer(playerId);
    return all.filter((g) => g.status !== 'achieved');
  }

  async findGoalById(id: string): Promise<DevelopmentGoalRow | undefined> {
    const results = await db.select().from(developmentGoals).where(eq(developmentGoals.id, id));
    return results[0];
  }

  async createGoal(data: CreateGoalData): Promise<DevelopmentGoalRow> {
    const now = new Date().toISOString();
    const goal: DevelopmentGoalRow = {
      id: nanoid(),
      playerId: data.playerId,
      seasonId: data.seasonId ?? null,
      category: data.category,
      positionGroup: data.positionGroup,
      title: data.title,
      description: data.description ?? null,
      status: 'working_on_it',
      targetDate: data.targetDate ?? null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(developmentGoals).values(goal);
    return goal;
  }

  async updateGoalStatus(id: string, status: string): Promise<DevelopmentGoalRow | undefined> {
    const existing = await this.findGoalById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const updated = { ...existing, status, updatedAt: now };
    await db.update(developmentGoals).set(updated).where(eq(developmentGoals.id, id));
    return updated;
  }

  async deleteGoal(id: string): Promise<boolean> {
    await db.delete(developmentGoals).where(eq(developmentGoals.id, id));
    return true;
  }

  // === Observations ===

  async findObservationsByGoal(goalId: string): Promise<DevelopmentObservationRow[]> {
    return db.select().from(developmentObservations)
      .where(eq(developmentObservations.goalId, goalId))
      .orderBy(developmentObservations.observedAt);
  }

  async findObservationsByPlayer(playerId: string): Promise<DevelopmentObservationRow[]> {
    return db.select().from(developmentObservations)
      .where(eq(developmentObservations.playerId, playerId))
      .orderBy(developmentObservations.observedAt);
  }

  async createObservation(data: CreateObservationData): Promise<DevelopmentObservationRow> {
    const now = new Date().toISOString();
    const obs: DevelopmentObservationRow = {
      id: nanoid(),
      goalId: data.goalId ?? null,
      playerId: data.playerId,
      fixtureId: data.fixtureId ?? null,
      observation: data.observation,
      observedAt: data.observedAt,
      createdAt: now,
    };
    await db.insert(developmentObservations).values(obs);
    return obs;
  }

  async deleteObservation(id: string): Promise<boolean> {
    await db.delete(developmentObservations).where(eq(developmentObservations.id, id));
    return true;
  }

  // === Goal Library ===

  async findLibraryGoals(positionGroup?: string, category?: string): Promise<GoalLibraryRow[]> {
    let results = await db.select().from(developmentGoalLibrary).orderBy(developmentGoalLibrary.positionGroup, developmentGoalLibrary.category);
    if (positionGroup) results = results.filter((g) => g.positionGroup === positionGroup);
    if (category) results = results.filter((g) => g.category === category);
    return results;
  }

  async createLibraryGoal(data: { category: string; positionGroup: string; title: string; description?: string; isCustom?: boolean }): Promise<GoalLibraryRow> {
    const now = new Date().toISOString();
    const goal: GoalLibraryRow = {
      id: nanoid(),
      category: data.category,
      positionGroup: data.positionGroup,
      title: data.title,
      description: data.description ?? null,
      isCustom: data.isCustom ?? true,
      createdAt: now,
    };
    await db.insert(developmentGoalLibrary).values(goal);
    return goal;
  }

  async seedLibrary(items: { category: string; positionGroup: string; title: string; description?: string }[]): Promise<void> {
    const existing = await db.select().from(developmentGoalLibrary);
    if (existing.length > 0) return; // already seeded

    const now = new Date().toISOString();
    for (const item of items) {
      await db.insert(developmentGoalLibrary).values({
        id: nanoid(),
        category: item.category,
        positionGroup: item.positionGroup,
        title: item.title,
        description: item.description ?? null,
        isCustom: false,
        createdAt: now,
      });
    }
  }
}

export const developmentRepository = new DevelopmentRepository();
