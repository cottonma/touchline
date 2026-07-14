import { db } from '../db/index.js';
import { availability } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Availability Repository - Data access layer for player availability per fixture.
 */

export interface AvailabilityRow {
  id: string;
  fixtureId: string;
  playerId: string;
  status: string;
  reason: string | null;
  updatedAt: string;
}

export interface UpsertAvailabilityData {
  fixtureId: string;
  playerId: string;
  status: string;
  reason?: string;
}

export class AvailabilityRepository {
  /**
   * Get all availability records for a fixture.
   */
  async findByFixture(fixtureId: string): Promise<AvailabilityRow[]> {
    return db
      .select()
      .from(availability)
      .where(eq(availability.fixtureId, fixtureId));
  }

  /**
   * Get availability for a specific player and fixture.
   */
  async findByFixtureAndPlayer(fixtureId: string, playerId: string): Promise<AvailabilityRow | undefined> {
    const results = await db
      .select()
      .from(availability)
      .where(and(eq(availability.fixtureId, fixtureId), eq(availability.playerId, playerId)));
    return results[0];
  }

  /**
   * Upsert availability - create or update based on fixture+player unique combination.
   */
  async upsert(data: UpsertAvailabilityData): Promise<AvailabilityRow> {
    const now = new Date().toISOString();
    const existing = await this.findByFixtureAndPlayer(data.fixtureId, data.playerId);

    if (existing) {
      const updated: AvailabilityRow = {
        ...existing,
        status: data.status,
        reason: data.reason ?? existing.reason,
        updatedAt: now,
      };
      await db.update(availability).set(updated).where(eq(availability.id, existing.id));
      return updated;
    }

    const newRecord: AvailabilityRow = {
      id: nanoid(),
      fixtureId: data.fixtureId,
      playerId: data.playerId,
      status: data.status,
      reason: data.reason ?? null,
      updatedAt: now,
    };

    await db.insert(availability).values(newRecord);
    return newRecord;
  }

  /**
   * Batch upsert availability for multiple players at once.
   */
  async batchUpsert(items: UpsertAvailabilityData[]): Promise<AvailabilityRow[]> {
    const results: AvailabilityRow[] = [];
    for (const item of items) {
      const result = await this.upsert(item);
      results.push(result);
    }
    return results;
  }

  /**
   * Get availability summary for a fixture.
   */
  async getSummary(fixtureId: string): Promise<{ available: number; unavailable: number; unknown: number }> {
    const records = await this.findByFixture(fixtureId);
    return {
      available: records.filter((r) => r.status === 'available').length,
      unavailable: records.filter((r) => r.status === 'unavailable').length,
      unknown: records.filter((r) => r.status === 'unknown').length,
    };
  }

  /**
   * Get all availability for a player across fixtures.
   */
  async findByPlayer(playerId: string): Promise<AvailabilityRow[]> {
    return db
      .select()
      .from(availability)
      .where(eq(availability.playerId, playerId));
  }
}

// Singleton instance
export const availabilityRepository = new AvailabilityRepository();
