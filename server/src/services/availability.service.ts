import {
  availabilityRepository,
  type UpsertAvailabilityData,
  type AvailabilityRow,
} from '../repositories/availability.repository.js';
import { fixtureRepository } from '../repositories/fixture.repository.js';
import { playerRepository } from '../repositories/player.repository.js';

/**
 * Availability Service - Business logic for availability tracking.
 */

export interface AvailabilityServiceError {
  code: string;
  message: string;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: AvailabilityServiceError };

export interface AvailabilityWithPlayer extends AvailabilityRow {
  playerFirstName?: string;
  playerLastName?: string;
}

export class AvailabilityService {
  /**
   * Get availability for a fixture, merged with the full player list.
   * Players without an availability record show as 'unknown'.
   */
  async getFixtureAvailability(fixtureId: string): Promise<ServiceResult<AvailabilityWithPlayer[]>> {
    // Validate fixture exists
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: `Fixture with ID ${fixtureId} not found.` },
      };
    }

    // Get all active players
    const players = await playerRepository.findAll(false);

    // Get existing availability records for this fixture
    const records = await availabilityRepository.findByFixture(fixtureId);
    const recordMap = new Map(records.map((r) => [r.playerId, r]));

    // Merge: every active player gets an availability entry
    const merged: AvailabilityWithPlayer[] = players.map((player) => {
      const existing = recordMap.get(player.id);
      return {
        id: existing?.id ?? '',
        fixtureId,
        playerId: player.id,
        status: existing?.status ?? 'unknown',
        reason: existing?.reason ?? null,
        updatedAt: existing?.updatedAt ?? new Date().toISOString(),
        playerFirstName: player.firstName,
        playerLastName: player.lastName,
      };
    });

    return { success: true, data: merged };
  }

  /**
   * Update availability for a single player/fixture combination.
   */
  async updateAvailability(data: UpsertAvailabilityData): Promise<ServiceResult<AvailabilityRow>> {
    // Validate fixture exists
    const fixture = await fixtureRepository.findById(data.fixtureId);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' },
      };
    }

    // Validate player exists
    const player = await playerRepository.findById(data.playerId);
    if (!player) {
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found.' },
      };
    }

    // Validate status
    if (!['available', 'unavailable', 'unknown'].includes(data.status)) {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Status must be available, unavailable, or unknown.' },
      };
    }

    const result = await availabilityRepository.upsert(data);
    return { success: true, data: result };
  }

  /**
   * Batch update availability for multiple players at once.
   * This is the primary use case - coach updates the whole squad's availability in one go.
   */
  async batchUpdateAvailability(
    fixtureId: string,
    items: { playerId: string; status: string; reason?: string }[]
  ): Promise<ServiceResult<AvailabilityRow[]>> {
    // Validate fixture exists
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' },
      };
    }

    const upsertData: UpsertAvailabilityData[] = items.map((item) => ({
      fixtureId,
      playerId: item.playerId,
      status: item.status,
      reason: item.reason,
    }));

    const results = await availabilityRepository.batchUpsert(upsertData);
    return { success: true, data: results };
  }

  /**
   * Get availability summary for a fixture.
   */
  async getAvailabilitySummary(fixtureId: string) {
    return availabilityRepository.getSummary(fixtureId);
  }
}

// Singleton instance
export const availabilityService = new AvailabilityService();
