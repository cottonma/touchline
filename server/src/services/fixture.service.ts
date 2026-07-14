import {
  fixtureRepository,
  type CreateFixtureData,
  type UpdateFixtureData,
  type FixtureRow,
} from '../repositories/fixture.repository.js';

/**
 * Fixture Service - Business logic for fixture management.
 * Handles validation rules and orchestration.
 */

export interface FixtureServiceError {
  code: string;
  message: string;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: FixtureServiceError };

export class FixtureService {
  /**
   * Get all fixtures, optionally filtered by season.
   */
  async getAllFixtures(seasonId?: string): Promise<FixtureRow[]> {
    if (seasonId) {
      return fixtureRepository.findBySeason(seasonId);
    }
    return fixtureRepository.findAll();
  }

  /**
   * Get upcoming fixtures.
   */
  async getUpcomingFixtures(seasonId?: string): Promise<FixtureRow[]> {
    return fixtureRepository.findUpcoming(seasonId);
  }

  /**
   * Get completed fixtures.
   */
  async getCompletedFixtures(seasonId?: string): Promise<FixtureRow[]> {
    return fixtureRepository.findCompleted(seasonId);
  }

  /**
   * Get fixtures by type.
   */
  async getFixturesByType(type: string, seasonId?: string): Promise<FixtureRow[]> {
    return fixtureRepository.findByType(type, seasonId);
  }

  /**
   * Get the next upcoming fixture.
   */
  async getNextFixture(seasonId?: string): Promise<FixtureRow | undefined> {
    return fixtureRepository.findNext(seasonId);
  }

  /**
   * Get a fixture by ID.
   */
  async getFixtureById(id: string): Promise<ServiceResult<FixtureRow>> {
    const fixture = await fixtureRepository.findById(id);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: `Fixture with ID ${id} not found.` },
      };
    }
    return { success: true, data: fixture };
  }

  /**
   * Create a new fixture with business rule validation.
   */
  async createFixture(data: CreateFixtureData): Promise<ServiceResult<FixtureRow>> {
    // Validate: matches and friendlies should have an opponent
    if ((data.type === 'match' || data.type === 'friendly') && !data.opponent) {
      return {
        success: false,
        error: {
          code: 'OPPONENT_REQUIRED',
          message: 'An opponent is required for matches and friendlies.',
        },
      };
    }

    // Validate: training sessions shouldn't have an opponent or home/away
    if (data.type === 'training') {
      data.opponent = undefined;
      data.homeAway = undefined;
      data.matchObjective = undefined;
    }

    const fixture = await fixtureRepository.create(data);
    return { success: true, data: fixture };
  }

  /**
   * Update a fixture.
   */
  async updateFixture(id: string, data: UpdateFixtureData): Promise<ServiceResult<FixtureRow>> {
    const existing = await fixtureRepository.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: `Fixture with ID ${id} not found.` },
      };
    }

    // Can't update a cancelled fixture (must be un-cancelled first)
    if (existing.status === 'cancelled' && data.status !== 'scheduled') {
      return {
        success: false,
        error: { code: 'FIXTURE_CANCELLED', message: 'Cannot update a cancelled fixture. Reschedule it first.' },
      };
    }

    const updated = await fixtureRepository.update(id, data);
    if (!updated) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update fixture.' },
      };
    }

    return { success: true, data: updated };
  }

  /**
   * Cancel a fixture.
   */
  async cancelFixture(id: string): Promise<ServiceResult<FixtureRow>> {
    const existing = await fixtureRepository.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: `Fixture with ID ${id} not found.` },
      };
    }

    if (existing.status === 'completed') {
      return {
        success: false,
        error: { code: 'CANNOT_CANCEL_COMPLETED', message: 'Cannot cancel a completed fixture.' },
      };
    }

    const updated = await fixtureRepository.update(id, { status: 'cancelled' });
    return { success: true, data: updated! };
  }

  /**
   * Delete a fixture permanently (only if scheduled and no related data).
   */
  async deleteFixture(id: string): Promise<ServiceResult<{ message: string }>> {
    const existing = await fixtureRepository.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: `Fixture with ID ${id} not found.` },
      };
    }

    if (existing.status === 'completed') {
      return {
        success: false,
        error: {
          code: 'CANNOT_DELETE_COMPLETED',
          message: 'Cannot delete a completed fixture. Use cancel instead.',
        },
      };
    }

    await fixtureRepository.delete(id);
    return { success: true, data: { message: 'Fixture deleted successfully.' } };
  }

  /**
   * Get fixture count by status.
   */
  async getFixtureCounts(seasonId: string) {
    return fixtureRepository.countByStatus(seasonId);
  }
}

// Singleton instance
export const fixtureService = new FixtureService();
