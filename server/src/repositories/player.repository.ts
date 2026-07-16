import { db } from '../db/index.js';
import { players } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Player Repository - Data access layer for player CRUD operations.
 * Handles all direct database interactions for the players table.
 */

export interface PlayerRow {
  id: string;
  clubId: string | null;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  dateOfBirth: string | null;
  preferredFoot: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  isGkVolunteer: boolean;
  photoUrl: string | null;
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  medicalNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlayerData {
  firstName: string;
  lastName: string;
  shirtNumber?: number;
  dateOfBirth?: string;
  preferredFoot?: string;
  primaryPosition: string;
  secondaryPosition?: string;
  tertiaryPosition?: string;
  isGkVolunteer?: boolean;
  photoUrl?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  medicalNotes?: string;
  clubId?: string;
}

export interface UpdatePlayerData {
  firstName?: string;
  lastName?: string;
  shirtNumber?: number | null;
  dateOfBirth?: string | null;
  preferredFoot?: string | null;
  primaryPosition?: string;
  secondaryPosition?: string | null;
  tertiaryPosition?: string | null;
  isGkVolunteer?: boolean;
  photoUrl?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  medicalNotes?: string | null;
  isActive?: boolean;
}

export class PlayerRepository {
  /**
   * Get all active players, ordered by last name then first name.
   * If clubId is provided, only return players belonging to that club.
   */
  async findAll(includeInactive = false, clubId?: string): Promise<PlayerRow[]> {
    const conditions = [];

    if (!includeInactive) {
      conditions.push(eq(players.isActive, true));
    }

    if (clubId) {
      conditions.push(eq(players.clubId, clubId));
    }

    if (conditions.length === 0) {
      return db.select().from(players).orderBy(players.lastName, players.firstName);
    }

    return db
      .select()
      .from(players)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(players.lastName, players.firstName);
  }

  /**
   * Get a single player by ID.
   */
  async findById(id: string): Promise<PlayerRow | undefined> {
    const results = await db.select().from(players).where(eq(players.id, id));
    return results[0];
  }

  /**
   * Create a new player.
   */
  async create(data: CreatePlayerData): Promise<PlayerRow> {
    const now = new Date().toISOString();
    const id = nanoid();

    const newPlayer = {
      id,
      clubId: data.clubId ?? null,
      firstName: data.firstName,
      lastName: data.lastName,
      shirtNumber: data.shirtNumber ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      preferredFoot: data.preferredFoot ?? null,
      primaryPosition: data.primaryPosition,
      secondaryPosition: data.secondaryPosition ?? null,
      tertiaryPosition: data.tertiaryPosition ?? null,
      isGkVolunteer: data.isGkVolunteer ?? false,
      photoUrl: data.photoUrl ?? null,
      parentName: data.parentName ?? null,
      parentEmail: data.parentEmail ?? null,
      parentPhone: data.parentPhone ?? null,
      medicalNotes: data.medicalNotes ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(players).values(newPlayer);
    return newPlayer;
  }

  /**
   * Update an existing player.
   */
  async update(id: string, data: UpdatePlayerData): Promise<PlayerRow | undefined> {
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

    await db.update(players).set(updated).where(eq(players.id, id));
    return updated as PlayerRow;
  }

  /**
   * Soft delete a player (mark as inactive).
   * Historical data is preserved.
   */
  async deactivate(id: string): Promise<boolean> {
    const result = await this.update(id, { isActive: false });
    return result !== undefined;
  }

  /**
   * Reactivate a previously deactivated player.
   */
  async reactivate(id: string): Promise<boolean> {
    const result = await this.update(id, { isActive: true });
    return result !== undefined;
  }

  /**
   * Check if a shirt number is already in use by an active player.
   */
  async isShirtNumberTaken(shirtNumber: number, excludePlayerId?: string, clubId?: string): Promise<boolean> {
    const conditions = [
      eq(players.shirtNumber, shirtNumber),
      eq(players.isActive, true),
    ];

    if (clubId) {
      conditions.push(eq(players.clubId, clubId));
    }

    const results = await db
      .select({ id: players.id })
      .from(players)
      .where(and(...conditions));

    if (excludePlayerId) {
      return results.some((r) => r.id !== excludePlayerId);
    }
    return results.length > 0;
  }

  /**
   * Get count of active players.
   */
  async countActive(): Promise<number> {
    const results = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.isActive, true));
    return results.length;
  }

  /**
   * Get all GK volunteers (active only).
   */
  async findGkVolunteers(): Promise<PlayerRow[]> {
    return db
      .select()
      .from(players)
      .where(and(eq(players.isActive, true), eq(players.isGkVolunteer, true)))
      .orderBy(players.lastName, players.firstName);
  }
}

// Singleton instance
export const playerRepository = new PlayerRepository();
