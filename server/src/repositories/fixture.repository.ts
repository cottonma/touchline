import { db } from '../db/index.js';
import { fixtures } from '../db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Fixture Repository - Data access layer for fixture CRUD operations.
 * Handles matches, training sessions, friendlies, and tournaments.
 */

export interface FixtureRow {
  id: string;
  seasonId: string;
  type: string;
  opponent: string | null;
  location: string | null;
  date: string;
  kickOffTime: string | null;
  homeAway: string | null;
  status: string;
  matchObjective: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixtureData {
  seasonId: string;
  type: string;
  opponent?: string;
  location?: string;
  date: string;
  kickOffTime?: string;
  homeAway?: string;
  matchObjective?: string;
  notes?: string;
}

export interface UpdateFixtureData {
  type?: string;
  opponent?: string | null;
  location?: string | null;
  date?: string;
  kickOffTime?: string | null;
  homeAway?: string | null;
  status?: string;
  matchObjective?: string | null;
  notes?: string | null;
}

export class FixtureRepository {
  /**
   * Get all fixtures for a season, ordered by date descending (most recent first).
   */
  async findBySeason(seasonId: string): Promise<FixtureRow[]> {
    return db
      .select()
      .from(fixtures)
      .where(eq(fixtures.seasonId, seasonId))
      .orderBy(desc(fixtures.date));
  }

  /**
   * Get all fixtures (across all seasons), ordered by date descending.
   */
  async findAll(): Promise<FixtureRow[]> {
    return db.select().from(fixtures).orderBy(desc(fixtures.date));
  }

  /**
   * Get upcoming fixtures (scheduled, date >= today).
   */
  async findUpcoming(seasonId?: string): Promise<FixtureRow[]> {
    const today = new Date().toISOString().split('T')[0];
    const conditions = [
      eq(fixtures.status, 'scheduled'),
      gte(fixtures.date, today),
    ];
    if (seasonId) {
      conditions.push(eq(fixtures.seasonId, seasonId));
    }
    return db
      .select()
      .from(fixtures)
      .where(and(...conditions))
      .orderBy(fixtures.date);
  }

  /**
   * Get past fixtures (completed).
   */
  async findCompleted(seasonId?: string): Promise<FixtureRow[]> {
    const conditions = [eq(fixtures.status, 'completed')];
    if (seasonId) {
      conditions.push(eq(fixtures.seasonId, seasonId));
    }
    return db
      .select()
      .from(fixtures)
      .where(and(...conditions))
      .orderBy(desc(fixtures.date));
  }

  /**
   * Get fixtures by type.
   */
  async findByType(type: string, seasonId?: string): Promise<FixtureRow[]> {
    const conditions = [eq(fixtures.type, type)];
    if (seasonId) {
      conditions.push(eq(fixtures.seasonId, seasonId));
    }
    return db
      .select()
      .from(fixtures)
      .where(and(...conditions))
      .orderBy(desc(fixtures.date));
  }

  /**
   * Get next upcoming fixture.
   */
  async findNext(seasonId?: string): Promise<FixtureRow | undefined> {
    const upcoming = await this.findUpcoming(seasonId);
    return upcoming[0];
  }

  /**
   * Get a single fixture by ID.
   */
  async findById(id: string): Promise<FixtureRow | undefined> {
    const results = await db.select().from(fixtures).where(eq(fixtures.id, id));
    return results[0];
  }

  /**
   * Create a new fixture.
   */
  async create(data: CreateFixtureData): Promise<FixtureRow> {
    const now = new Date().toISOString();
    const id = nanoid();

    const newFixture: FixtureRow = {
      id,
      seasonId: data.seasonId,
      type: data.type,
      opponent: data.opponent ?? null,
      location: data.location ?? null,
      date: data.date,
      kickOffTime: data.kickOffTime ?? null,
      homeAway: data.homeAway ?? null,
      status: 'scheduled',
      matchObjective: data.matchObjective ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(fixtures).values(newFixture);
    return newFixture;
  }

  /**
   * Update an existing fixture.
   */
  async update(id: string, data: UpdateFixtureData): Promise<FixtureRow | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      ...Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      ),
      updatedAt: now,
    };

    await db.update(fixtures).set(updated).where(eq(fixtures.id, id));
    return updated as FixtureRow;
  }

  /**
   * Delete a fixture permanently.
   * Only allowed for scheduled fixtures (not completed ones with recorded data).
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await db.delete(fixtures).where(eq(fixtures.id, id));
    return true;
  }

  /**
   * Count fixtures by status for a season.
   */
  async countByStatus(seasonId: string): Promise<{ scheduled: number; completed: number; cancelled: number }> {
    const all = await this.findBySeason(seasonId);
    return {
      scheduled: all.filter((f) => f.status === 'scheduled').length,
      completed: all.filter((f) => f.status === 'completed').length,
      cancelled: all.filter((f) => f.status === 'cancelled').length,
    };
  }
}

// Singleton instance
export const fixtureRepository = new FixtureRepository();
