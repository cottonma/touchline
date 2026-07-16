import {
  playerRepository,
  type CreatePlayerData,
  type UpdatePlayerData,
  type PlayerRow,
} from '../repositories/player.repository.js';

/**
 * Player Service - Business logic for player management.
 * Handles validation rules, business constraints, and orchestration.
 */

export interface PlayerServiceError {
  code: string;
  message: string;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: PlayerServiceError };

export class PlayerService {
  /**
   * Get all players, optionally filtered by club.
   */
  async getAllPlayers(includeInactive = false, clubId?: string): Promise<PlayerRow[]> {
    return playerRepository.findAll(includeInactive, clubId);
  }

  /**
   * Get a player by ID.
   */
  async getPlayerById(id: string): Promise<ServiceResult<PlayerRow>> {
    const player = await playerRepository.findById(id);
    if (!player) {
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: `Player with ID ${id} not found.` },
      };
    }
    return { success: true, data: player };
  }

  /**
   * Create a new player with business rule validation.
   */
  async createPlayer(data: CreatePlayerData): Promise<ServiceResult<PlayerRow>> {
    // Validate shirt number uniqueness (scoped to same club)
    if (data.shirtNumber) {
      const taken = await playerRepository.isShirtNumberTaken(data.shirtNumber, undefined, data.clubId);
      if (taken) {
        return {
          success: false,
          error: {
            code: 'SHIRT_NUMBER_TAKEN',
            message: `Shirt number ${data.shirtNumber} is already assigned to another player.`,
          },
        };
      }
    }

    // Validate positions are different
    if (data.secondaryPosition && data.primaryPosition === data.secondaryPosition) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_POSITION',
          message: 'Primary and secondary positions must be different.',
        },
      };
    }

    const player = await playerRepository.create(data);
    return { success: true, data: player };
  }

  /**
   * Update a player with business rule validation.
   */
  async updatePlayer(id: string, data: UpdatePlayerData): Promise<ServiceResult<PlayerRow>> {
    // Check player exists
    const existing = await playerRepository.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: `Player with ID ${id} not found.` },
      };
    }

    // Validate shirt number uniqueness (if changing)
    if (data.shirtNumber !== undefined && data.shirtNumber !== null) {
      const taken = await playerRepository.isShirtNumberTaken(data.shirtNumber, id);
      if (taken) {
        return {
          success: false,
          error: {
            code: 'SHIRT_NUMBER_TAKEN',
            message: `Shirt number ${data.shirtNumber} is already assigned to another player.`,
          },
        };
      }
    }

    // Validate positions are different
    const primaryPos = data.primaryPosition ?? existing.primaryPosition;
    const secondaryPos = data.secondaryPosition !== undefined ? data.secondaryPosition : existing.secondaryPosition;
    if (secondaryPos && primaryPos === secondaryPos) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_POSITION',
          message: 'Primary and secondary positions must be different.',
        },
      };
    }

    const updated = await playerRepository.update(id, data);
    if (!updated) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update player.' },
      };
    }

    return { success: true, data: updated };
  }

  /**
   * Deactivate a player (soft delete).
   */
  async deactivatePlayer(id: string): Promise<ServiceResult<{ message: string }>> {
    const existing = await playerRepository.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: `Player with ID ${id} not found.` },
      };
    }

    if (!existing.isActive) {
      return {
        success: false,
        error: { code: 'ALREADY_INACTIVE', message: 'Player is already inactive.' },
      };
    }

    await playerRepository.deactivate(id);
    return { success: true, data: { message: `${existing.firstName} ${existing.lastName} has been deactivated.` } };
  }

  /**
   * Reactivate a player.
   */
  async reactivatePlayer(id: string): Promise<ServiceResult<PlayerRow>> {
    const existing = await playerRepository.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: `Player with ID ${id} not found.` },
      };
    }

    if (existing.isActive) {
      return {
        success: false,
        error: { code: 'ALREADY_ACTIVE', message: 'Player is already active.' },
      };
    }

    const reactivated = await playerRepository.update(id, { isActive: true });
    return { success: true, data: reactivated! };
  }

  /**
   * Get squad count.
   */
  async getSquadCount(): Promise<number> {
    return playerRepository.countActive();
  }

  /**
   * Get all goalkeeper volunteers.
   */
  async getGkVolunteers(): Promise<PlayerRow[]> {
    return playerRepository.findGkVolunteers();
  }
}

// Singleton instance
export const playerService = new PlayerService();
