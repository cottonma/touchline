import { db } from '../db/index.js';
import { matchPlans, matchPlanSlots, seasons, fixtures } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { MATCH_FORMATS } from '../constants.js';
import {
  generateSubstitutionPlan,
  suggestGkAssignments,
  type SubstitutionPlan,
  type PlayerForSelection,
  type GkAssignment,
  type EngineConfig,
} from '../engines/playing-time.engine.js';
import { playerRepository } from '../repositories/player.repository.js';
import { availabilityRepository } from '../repositories/availability.repository.js';
import { fixtureRepository } from '../repositories/fixture.repository.js';
import { policyService } from './policy.service.js';

export interface MatchPlanRow {
  id: string;
  fixtureId: string;
  clubId: string | null;
  status: string;
  formation: string | null;
  periods: number;
  periodDurationMinutes: string;
  matchDurationMinutes: number;
  outfieldSlots: number;
  generatedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchPlanSlotRow {
  id: string;
  matchPlanId: string;
  period: number;
  playerId: string;
  position: string;
  isGk: boolean;
  startMinute: number;
  endMinute: number;
  createdAt: string;
}

export interface SlotInput {
  period: number;
  playerId: string;
  position: string;
  isGk?: boolean;
  startMinute?: number;
  endMinute?: number;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export class MatchPlanService {
  /**
   * Get or create a match plan for a fixture.
   * If no plan exists, creates a blank one using season config.
   */
  async getOrCreatePlan(fixtureId: string, clubId?: string): Promise<ServiceResult<{ plan: MatchPlanRow; slots: MatchPlanSlotRow[] }>> {
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) {
      return { success: false, error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' } };
    }

    // Check for existing plan
    const [existing] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
    if (existing) {
      const slots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, existing.id));
      return { success: true, data: { plan: existing, slots } };
    }

    // Create new blank plan from season config
    const seasonConfig = await this.getSeasonConfig(fixture.seasonId);
    if (!seasonConfig) {
      return { success: false, error: { code: 'SEASON_NOT_FOUND', message: 'Season config not found.' } };
    }

    const formatConfig = MATCH_FORMATS[seasonConfig.format as keyof typeof MATCH_FORMATS];
    if (!formatConfig) {
      return { success: false, error: { code: 'INVALID_FORMAT', message: `Unknown format: ${seasonConfig.format}` } };
    }

    const periodDuration = seasonConfig.matchDurationMinutes / seasonConfig.periods;
    const now = new Date().toISOString();
    const planId = nanoid();

    await db.insert(matchPlans).values({
      id: planId,
      fixtureId,
      clubId: clubId ?? null,
      status: 'draft',
      formation: seasonConfig.formation,
      periods: seasonConfig.periods,
      periodDurationMinutes: String(periodDuration),
      matchDurationMinutes: seasonConfig.matchDurationMinutes,
      outfieldSlots: formatConfig.outfieldPlayers,
      generatedBy: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    });

    const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.id, planId)).limit(1);
    return { success: true, data: { plan, slots: [] } };
  }

  /**
   * Get an existing plan with its slots.
   */
  async getPlan(fixtureId: string): Promise<ServiceResult<{ plan: MatchPlanRow; slots: MatchPlanSlotRow[] } | null>> {
    const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
    if (!plan) return { success: true, data: null };
    const slots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));
    return { success: true, data: { plan, slots } };
  }

  /**
   * Update plan slots — replaces all slots for a given period, or all periods.
   * This is the primary edit operation: client sends the full slot state.
   */
  async updateSlots(fixtureId: string, slots: SlotInput[]): Promise<ServiceResult<MatchPlanSlotRow[]>> {
    const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
    if (!plan) {
      return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'No match plan for this fixture.' } };
    }

    const periodDuration = Number(plan.periodDurationMinutes);
    const now = new Date().toISOString();

    // Determine which periods are being updated
    const periodsToUpdate = [...new Set(slots.map(s => s.period))];

    // Delete existing slots for those periods
    for (const period of periodsToUpdate) {
      const existingSlots = await db.select().from(matchPlanSlots)
        .where(and(eq(matchPlanSlots.matchPlanId, plan.id), eq(matchPlanSlots.period, period)));
      for (const slot of existingSlots) {
        await db.delete(matchPlanSlots).where(eq(matchPlanSlots.id, slot.id));
      }
    }

    // Insert new slots
    for (const slot of slots) {
      await db.insert(matchPlanSlots).values({
        id: nanoid(),
        matchPlanId: plan.id,
        period: slot.period,
        playerId: slot.playerId,
        position: slot.position,
        isGk: slot.isGk ?? false,
        startMinute: slot.startMinute ?? 0,
        endMinute: slot.endMinute ?? periodDuration,
        createdAt: now,
      });
    }

    // Update plan timestamp
    await db.update(matchPlans).set({ updatedAt: now }).where(eq(matchPlans.id, plan.id));

    // Return all slots
    const allSlots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));
    return { success: true, data: allSlots };
  }

  /**
   * Update plan status.
   */
  async updateStatus(fixtureId: string, status: string): Promise<ServiceResult<MatchPlanRow>> {
    const validStatuses = ['not_started', 'draft', 'ready', 'match_started', 'completed'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: { code: 'INVALID_STATUS', message: `Status must be: ${validStatuses.join(', ')}` } };
    }

    const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
    if (!plan) {
      return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'No match plan for this fixture.' } };
    }

    const now = new Date().toISOString();
    await db.update(matchPlans).set({ status, updatedAt: now }).where(eq(matchPlans.id, plan.id));

    const [updated] = await db.select().from(matchPlans).where(eq(matchPlans.id, plan.id)).limit(1);
    return { success: true, data: updated };
  }

  /**
   * Generate a team plan using the engine and populate slots.
   * Returns the plan with all slots filled by the algorithm.
   */
  async generatePlan(fixtureId: string, clubId?: string, gkOverrides?: GkAssignment[]): Promise<ServiceResult<{ plan: MatchPlanRow; slots: MatchPlanSlotRow[] }>> {
    // Ensure plan exists
    const planResult = await this.getOrCreatePlan(fixtureId, clubId);
    if (!planResult.success) return planResult;

    const { plan } = planResult.data;
    const fixture = await fixtureRepository.findById(fixtureId);
    if (!fixture) return { success: false, error: { code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found.' } };

    // Get available players
    const availabilityRecords = await availabilityRepository.findByFixture(fixtureId);
    const availablePlayerIds = availabilityRecords.filter(r => r.status === 'available').map(r => r.playerId);

    if (availablePlayerIds.length === 0) {
      return { success: false, error: { code: 'NO_AVAILABLE_PLAYERS', message: 'No players marked as available.' } };
    }

    const allPlayers = await playerRepository.findAll(false, clubId);
    const availablePlayers: PlayerForSelection[] = allPlayers
      .filter(p => availablePlayerIds.includes(p.id))
      .map(p => ({
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

    const formatConfig = MATCH_FORMATS[`${plan.outfieldSlots + 1}v${plan.outfieldSlots + 1}` as keyof typeof MATCH_FORMATS];

    const engineConfig: EngineConfig = {
      matchDurationMinutes: plan.matchDurationMinutes,
      periods: plan.periods,
      outfieldSlots: plan.outfieldSlots,
      toleranceMinutes: playingTimeConfig.toleranceMinutes,
      maxConsecutiveBenchPeriods: playingTimeConfig.maxConsecutiveBenchPeriods,
      gkRewardFullOutfield: gkConfig.gkRewardFullOutfield,
      formation: plan.formation,
      minSubMinutes: playingTimeConfig.minSubMinutes ?? 5,
    };

    if (availablePlayers.length < plan.outfieldSlots + 1) {
      return { success: false, error: { code: 'NOT_ENOUGH_PLAYERS', message: `Need at least ${plan.outfieldSlots + 1} players.` } };
    }

    // GK assignments
    let gkAssignments: GkAssignment[];
    if (gkOverrides && gkOverrides.length > 0) {
      gkAssignments = gkOverrides;
    } else {
      const volunteers = availablePlayers.filter(p => p.isGkVolunteer);
      if (volunteers.length === 0) {
        return { success: false, error: { code: 'NO_GK_VOLUNTEERS', message: 'No GK volunteers available.' } };
      }
      gkAssignments = suggestGkAssignments(volunteers, new Map(), plan.periods, gkConfig.maxGkPeriodsPerMatch);
    }

    // Run engine
    const engineResult = generateSubstitutionPlan(availablePlayers, gkAssignments, engineConfig);

    // Convert engine output to slots
    const slots: SlotInput[] = [];
    for (const period of engineResult.periods) {
      for (const pp of period.onPitch) {
        slots.push({
          period: period.period,
          playerId: pp.playerId,
          position: pp.position,
          isGk: pp.isGk,
          startMinute: pp.startMinute,
          endMinute: pp.endMinute,
        });
      }
    }

    // Save slots (replaces all periods)
    const now = new Date().toISOString();

    // Clear all existing slots
    const existingSlots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));
    for (const s of existingSlots) {
      await db.delete(matchPlanSlots).where(eq(matchPlanSlots.id, s.id));
    }

    // Insert new slots
    for (const slot of slots) {
      await db.insert(matchPlanSlots).values({
        id: nanoid(),
        matchPlanId: plan.id,
        period: slot.period,
        playerId: slot.playerId,
        position: slot.position,
        isGk: slot.isGk ?? false,
        startMinute: slot.startMinute ?? 0,
        endMinute: slot.endMinute ?? Number(plan.periodDurationMinutes),
        createdAt: now,
      });
    }

    // Update plan metadata
    await db.update(matchPlans).set({ generatedBy: 'engine', updatedAt: now }).where(eq(matchPlans.id, plan.id));

    const [updatedPlan] = await db.select().from(matchPlans).where(eq(matchPlans.id, plan.id)).limit(1);
    const allSlots = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));

    return { success: true, data: { plan: updatedPlan, slots: allSlots } };
  }

  /**
   * Clear all slots for a plan (start fresh).
   */
  async clearPlan(fixtureId: string): Promise<ServiceResult<{ plan: MatchPlanRow; slots: MatchPlanSlotRow[] }>> {
    const [plan] = await db.select().from(matchPlans).where(eq(matchPlans.fixtureId, fixtureId)).limit(1);
    if (!plan) return { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'No match plan.' } };

    const existing = await db.select().from(matchPlanSlots).where(eq(matchPlanSlots.matchPlanId, plan.id));
    for (const s of existing) {
      await db.delete(matchPlanSlots).where(eq(matchPlanSlots.id, s.id));
    }

    const now = new Date().toISOString();
    await db.update(matchPlans).set({ generatedBy: null, updatedAt: now }).where(eq(matchPlans.id, plan.id));

    const [updated] = await db.select().from(matchPlans).where(eq(matchPlans.id, plan.id)).limit(1);
    return { success: true, data: { plan: updated, slots: [] } };
  }

  private async getSeasonConfig(seasonId: string) {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
    if (!season) return null;
    return {
      format: season.format,
      matchDurationMinutes: season.matchDurationMinutes,
      periods: season.periods,
      formation: season.formation ?? null,
    };
  }
}

export const matchPlanService = new MatchPlanService();
