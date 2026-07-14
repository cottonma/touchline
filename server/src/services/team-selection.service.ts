import {
  generateSubstitutionPlan,
  suggestGkAssignments,
  type PlayerForSelection,
  type EngineConfig,
  type SubstitutionPlan,
  type GkAssignment,
} from '../engines/playing-time.engine.js';
import { playerRepository } from '../repositories/player.repository.js';
import { availabilityRepository } from '../repositories/availability.repository.js';
import { fixtureRepository } from '../repositories/fixture.repository.js';
import { policyService } from './policy.service.js';
import { MATCH_FORMATS } from '../constants.js';
import { db } from '../db/index.js';
import { substitutionPlans } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Team Selection Service
 * 
 * Orchestrates the Equal Playing Time Engine:
 * 1. Gets available players for a fixture
 * 2. Reads coaching policies
 * 3. Determines GK assignment based on rotation
 * 4. Generates balanced substitution plan
 * 5. Returns plan for coach review
 */

export interface TeamSelectionServiceError {
  code: string;
  message: string;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: TeamSelectionServiceError };

export interface TeamSelectionResult {
  fixtureId: string;
  plan: SubstitutionPlan;
  availablePlayers: PlayerForSelection[];
  config: EngineConfig;
}

export interface ApprovedPlanData {
  fixtureId: string;
  plan: SubstitutionPlan;
  config: EngineConfig;
  availablePlayers: PlayerForSelection[];
  generatedBy: 'engine' | 'coach';
}

export class TeamSelectionService {
  /**
   * Generate a team selection and substitution plan for a fixture.
   */
  async generateTeamSelection(
    fixtureId: string,
    overrideGkAssignments?: GkAssignment[],
  ): Promise<ServiceResult<TeamSelectionResult>> {
    // 1. Validate fixture exists and is a match type
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' },
      };
    }

    if (fixture.type === 'training') {
      return {
        success: false,
        error: { code: 'NOT_A_MATCH', message: 'Team selection is only available for matches, friendlies, and tournaments.' },
      };
    }

    // 2. Get available players
    const availabilityRecords = await availabilityRepository.findByFixture(fixtureId);
    const availablePlayerIds = availabilityRecords
      .filter((r) => r.status === 'available')
      .map((r) => r.playerId);

    if (availablePlayerIds.length === 0) {
      return {
        success: false,
        error: { code: 'NO_AVAILABLE_PLAYERS', message: 'No players have been marked as available for this fixture.' },
      };
    }

    // Get full player data for available players
    const allPlayers = await playerRepository.findAll(false);
    const availablePlayers: PlayerForSelection[] = allPlayers
      .filter((p) => availablePlayerIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition,
        tertiaryPosition: p.tertiaryPosition ?? null,
        isGkVolunteer: p.isGkVolunteer,
      }));

    // 3. Read policies
    const playingTimeConfig = await policyService.getPlayingTimeConfig();
    const gkConfig = await policyService.getGoalkeeperConfig();

    // 4. Get season config for match format
    // For now, use the fixture's season
    const seasonResult = await this.getSeasonConfig(fixture.seasonId);
    if (!seasonResult) {
      return {
        success: false,
        error: { code: 'SEASON_NOT_FOUND', message: 'Season configuration not found.' },
      };
    }

    const { format, matchDurationMinutes, periods } = seasonResult;
    const formatConfig = MATCH_FORMATS[format as keyof typeof MATCH_FORMATS];
    if (!formatConfig) {
      return {
        success: false,
        error: { code: 'INVALID_FORMAT', message: `Unknown match format: ${format}` },
      };
    }

    const engineConfig: EngineConfig = {
      matchDurationMinutes,
      periods,
      outfieldSlots: formatConfig.outfieldPlayers,
      toleranceMinutes: playingTimeConfig.toleranceMinutes,
      maxConsecutiveBenchPeriods: playingTimeConfig.maxConsecutiveBenchPeriods,
      gkRewardFullOutfield: gkConfig.gkRewardFullOutfield,
      formation: seasonResult.formation,
      minSubMinutes: playingTimeConfig.minSubMinutes ?? 5,
    };

    // Validate minimum players
    if (availablePlayers.length < formatConfig.playersOnPitch) {
      return {
        success: false,
        error: {
          code: 'NOT_ENOUGH_PLAYERS',
          message: `Need at least ${formatConfig.playersOnPitch} players for ${format}. Only ${availablePlayers.length} available.`,
        },
      };
    }

    // 5. Determine GK assignments
    let gkAssignments: GkAssignment[];

    if (overrideGkAssignments && overrideGkAssignments.length > 0) {
      gkAssignments = overrideGkAssignments;
    } else {
      // Auto-suggest based on volunteer pool and rotation history
      const volunteers = availablePlayers.filter((p) => p.isGkVolunteer);
      if (volunteers.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_GK_VOLUNTEERS',
            message: 'No GK volunteers available. At least one available player must be a GK volunteer.',
          },
        };
      }

      // TODO: Get actual GK history from playing_time table for season rotation
      // For now, use empty history (first match of season scenario)
      const gkHistory = new Map<string, number>();
      gkAssignments = suggestGkAssignments(
        volunteers,
        gkHistory,
        periods,
        gkConfig.maxGkPeriodsPerMatch,
      );
    }

    // 6. Generate the plan
    const plan = generateSubstitutionPlan(availablePlayers, gkAssignments, engineConfig);

    return {
      success: true,
      data: {
        fixtureId,
        plan,
        availablePlayers,
        config: engineConfig,
      },
    };
  }

  /**
   * Approve (save) a finalized substitution plan for a fixture.
   */
  async approvePlan(data: ApprovedPlanData): Promise<ServiceResult<{ id: string }>> {
    const { fixtureId, plan, config, availablePlayers, generatedBy } = data;

    // Validate fixture exists
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' },
      };
    }

    const now = new Date().toISOString();

    // Check if an existing plan exists for this fixture - update it
    const existing = await db
      .select()
      .from(substitutionPlans)
      .where(eq(substitutionPlans.fixtureId, fixtureId));

    if (existing.length > 0) {
      await db
        .update(substitutionPlans)
        .set({
          plan: JSON.stringify({ plan, config, availablePlayers }),
          isApproved: true,
          generatedBy,
          updatedAt: now,
        })
        .where(eq(substitutionPlans.fixtureId, fixtureId));

      return { success: true, data: { id: existing[0].id } };
    }

    // Create new plan
    const id = nanoid();
    await db.insert(substitutionPlans).values({
      id,
      fixtureId,
      plan: JSON.stringify({ plan, config, availablePlayers }),
      isApproved: true,
      generatedBy,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, data: { id } };
  }

  /**
   * Get the approved substitution plan for a fixture.
   */
  async getApprovedPlan(fixtureId: string): Promise<ServiceResult<{ plan: SubstitutionPlan; config: EngineConfig; availablePlayers: PlayerForSelection[]; generatedBy: string } | null>> {
    const results = await db
      .select()
      .from(substitutionPlans)
      .where(and(eq(substitutionPlans.fixtureId, fixtureId), eq(substitutionPlans.isApproved, true)));

    if (results.length === 0) {
      return { success: true, data: null };
    }

    const row = results[0];
    const parsed = JSON.parse(row.plan) as { plan: SubstitutionPlan; config: EngineConfig; availablePlayers: PlayerForSelection[] };

    return {
      success: true,
      data: {
        plan: parsed.plan,
        config: parsed.config,
        availablePlayers: parsed.availablePlayers,
        generatedBy: row.generatedBy,
      },
    };
  }

  /**
   * Regenerate a plan with excluded players (for no-shows/injuries on match day).
   */
  async regenerateWithExclusions(
    fixtureId: string,
    excludePlayerIds: string[],
    overrideGkAssignments?: GkAssignment[],
  ): Promise<ServiceResult<TeamSelectionResult>> {
    // Validate fixture exists and is a match type
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return {
        success: false,
        error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' },
      };
    }

    if (fixture.type === 'training') {
      return {
        success: false,
        error: { code: 'NOT_A_MATCH', message: 'Team selection is only available for matches, friendlies, and tournaments.' },
      };
    }

    // Get available players
    const availabilityRecords = await availabilityRepository.findByFixture(fixtureId);
    const availablePlayerIds = availabilityRecords
      .filter((r) => r.status === 'available')
      .map((r) => r.playerId)
      .filter((id) => !excludePlayerIds.includes(id)); // Exclude no-shows

    if (availablePlayerIds.length === 0) {
      return {
        success: false,
        error: { code: 'NO_AVAILABLE_PLAYERS', message: 'No players available after exclusions.' },
      };
    }

    const allPlayers = await playerRepository.findAll(false);
    const availablePlayers: PlayerForSelection[] = allPlayers
      .filter((p) => availablePlayerIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition,
        tertiaryPosition: p.tertiaryPosition ?? null,
        isGkVolunteer: p.isGkVolunteer,
      }));

    // Read policies
    const playingTimeConfig = await policyService.getPlayingTimeConfig();
    const gkConfig = await policyService.getGoalkeeperConfig();

    const seasonResult = await this.getSeasonConfig(fixture.seasonId);
    if (!seasonResult) {
      return {
        success: false,
        error: { code: 'SEASON_NOT_FOUND', message: 'Season configuration not found.' },
      };
    }

    const { format, matchDurationMinutes, periods } = seasonResult;
    const formatConfig = MATCH_FORMATS[format as keyof typeof MATCH_FORMATS];
    if (!formatConfig) {
      return {
        success: false,
        error: { code: 'INVALID_FORMAT', message: `Unknown match format: ${format}` },
      };
    }

    const engineConfig: EngineConfig = {
      matchDurationMinutes,
      periods,
      outfieldSlots: formatConfig.outfieldPlayers,
      toleranceMinutes: playingTimeConfig.toleranceMinutes,
      maxConsecutiveBenchPeriods: playingTimeConfig.maxConsecutiveBenchPeriods,
      gkRewardFullOutfield: gkConfig.gkRewardFullOutfield,
      formation: seasonResult.formation,
      minSubMinutes: playingTimeConfig.minSubMinutes ?? 5,
    };

    if (availablePlayers.length < formatConfig.playersOnPitch) {
      return {
        success: false,
        error: {
          code: 'NOT_ENOUGH_PLAYERS',
          message: `Need at least ${formatConfig.playersOnPitch} players for ${format}. Only ${availablePlayers.length} available after exclusions.`,
        },
      };
    }

    // Determine GK assignments
    let gkAssignments: GkAssignment[];

    if (overrideGkAssignments && overrideGkAssignments.length > 0) {
      // Filter out excluded GKs
      gkAssignments = overrideGkAssignments.filter(
        (gk) => !excludePlayerIds.includes(gk.playerId)
      );
    } else {
      const volunteers = availablePlayers.filter((p) => p.isGkVolunteer);
      if (volunteers.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_GK_VOLUNTEERS',
            message: 'No GK volunteers available after exclusions.',
          },
        };
      }

      const gkHistory = new Map<string, number>();
      gkAssignments = suggestGkAssignments(
        volunteers,
        gkHistory,
        periods,
        gkConfig.maxGkPeriodsPerMatch,
      );
    }

    if (gkAssignments.length === 0) {
      return {
        success: false,
        error: { code: 'NO_GK_VOLUNTEERS', message: 'No GK volunteers available after exclusions.' },
      };
    }

    const plan = generateSubstitutionPlan(availablePlayers, gkAssignments, engineConfig);

    return {
      success: true,
      data: {
        fixtureId,
        plan,
        availablePlayers,
        config: engineConfig,
      },
    };
  }

  /**
   * Get season configuration (match format, duration, periods).
   */
  private async getSeasonConfig(seasonId: string) {
    const { seasons } = await import('../db/schema.js');

    const results = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    if (results.length === 0) return null;

    return {
      format: results[0].format,
      matchDurationMinutes: results[0].matchDurationMinutes,
      periods: results[0].periods,
      formation: results[0].formation ?? null,
    };
  }
}

// Singleton instance
export const teamSelectionService = new TeamSelectionService();
