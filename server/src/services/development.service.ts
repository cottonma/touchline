import { developmentRepository, type CreateGoalData, type CreateObservationData, type DevelopmentGoalRow, type DevelopmentObservationRow, type GoalLibraryRow } from '../repositories/development.repository.js';

/**
 * Development Service - Player development goals and observations.
 * FA Four Corners: Technical, Tactical, Physical, Psychological
 * Position Groups: GK, CB, LB, RB, CM, LM, RM, CF, All
 */

type ServiceResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

/** Pre-populated goal library based on FA coaching framework */
const GOAL_LIBRARY_SEED = [
  // CB - Technical
  { category: 'technical', positionGroup: 'CB', title: 'Uses both feet when passing' },
  { category: 'technical', positionGroup: 'CB', title: 'Clears the ball effectively under pressure' },
  { category: 'technical', positionGroup: 'CB', title: 'Wins headers consistently' },
  { category: 'technical', positionGroup: 'CB', title: 'Accurate long passes to switch play' },
  // CB - Tactical
  { category: 'tactical', positionGroup: 'CB', title: 'Scans before receiving the ball' },
  { category: 'tactical', positionGroup: 'CB', title: 'Maintains defensive shape when team loses possession' },
  { category: 'tactical', positionGroup: 'CB', title: 'Communicates with teammates when defending' },
  { category: 'tactical', positionGroup: 'CB', title: 'Tracks runners from midfield' },
  { category: 'tactical', positionGroup: 'CB', title: 'Positions correctly for goal kicks and restarts' },

  // LB/RB - Technical
  { category: 'technical', positionGroup: 'LB', title: 'Delivers accurate crosses into the box' },
  { category: 'technical', positionGroup: 'LB', title: 'Uses both feet when passing' },
  { category: 'technical', positionGroup: 'RB', title: 'Delivers accurate crosses into the box' },
  { category: 'technical', positionGroup: 'RB', title: 'Uses both feet when passing' },

  // CM - Technical
  { category: 'technical', positionGroup: 'CM', title: 'Controls the ball with a good first touch' },
  { category: 'technical', positionGroup: 'CM', title: 'Passes accurately over short and medium distances' },
  { category: 'technical', positionGroup: 'CM', title: 'Turns with the ball under pressure' },
  // CM - Tactical
  { category: 'tactical', positionGroup: 'CM', title: 'Scans before receiving possession' },
  { category: 'tactical', positionGroup: 'CM', title: 'Plays forward when the option is available' },
  { category: 'tactical', positionGroup: 'CM', title: 'Supports both attack and defence transitions' },
  { category: 'tactical', positionGroup: 'CM', title: 'Moves into positions to receive easy passes' },
  { category: 'tactical', positionGroup: 'CM', title: 'Dictates the tempo of play' },

  // LM/RM - Technical
  { category: 'technical', positionGroup: 'LM', title: 'Beats players 1v1 on both sides' },
  { category: 'technical', positionGroup: 'LM', title: 'Delivers accurate crosses into the box' },
  { category: 'technical', positionGroup: 'LM', title: 'Controls the ball on the move at pace' },
  { category: 'technical', positionGroup: 'LM', title: 'Cuts inside and shoots with weaker foot' },
  { category: 'technical', positionGroup: 'RM', title: 'Beats players 1v1 on both sides' },
  { category: 'technical', positionGroup: 'RM', title: 'Delivers accurate crosses into the box' },
  { category: 'technical', positionGroup: 'RM', title: 'Controls the ball on the move at pace' },
  { category: 'technical', positionGroup: 'RM', title: 'Cuts inside and shoots with weaker foot' },
  // LM/RM - Tactical
  { category: 'tactical', positionGroup: 'LM', title: 'Moves into positions to receive easy passes' },
  { category: 'tactical', positionGroup: 'LM', title: 'Tracks back to support defence' },
  { category: 'tactical', positionGroup: 'LM', title: 'Switches play when space is available on the opposite side' },
  { category: 'tactical', positionGroup: 'LM', title: 'Times runs in behind the full back' },
  { category: 'tactical', positionGroup: 'RM', title: 'Moves into positions to receive easy passes' },
  { category: 'tactical', positionGroup: 'RM', title: 'Tracks back to support defence' },
  { category: 'tactical', positionGroup: 'RM', title: 'Switches play when space is available on the opposite side' },
  { category: 'tactical', positionGroup: 'RM', title: 'Times runs in behind the full back' },

  // CF - Technical
  { category: 'technical', positionGroup: 'CF', title: 'Finishes with both feet' },
  { category: 'technical', positionGroup: 'CF', title: 'Controls long passes with first touch' },
  { category: 'technical', positionGroup: 'CF', title: 'Heads the ball on target' },
  { category: 'technical', positionGroup: 'CF', title: 'Shoots early when sight of goal' },
  // CF - Tactical
  { category: 'tactical', positionGroup: 'CF', title: 'Makes runs in behind the defence' },
  { category: 'tactical', positionGroup: 'CF', title: 'Links play by dropping deep' },
  { category: 'tactical', positionGroup: 'CF', title: 'Finds space between defenders' },
  { category: 'tactical', positionGroup: 'CF', title: 'Presses the ball when out of possession' },

  // GK - Technical
  { category: 'technical', positionGroup: 'GK', title: 'Sets position before the shot' },
  { category: 'technical', positionGroup: 'GK', title: 'Distributes accurately with hands and feet' },
  { category: 'technical', positionGroup: 'GK', title: 'Commands the area on crosses' },
  { category: 'technical', positionGroup: 'GK', title: 'Uses feet to play out from the back' },
  // GK - Tactical
  { category: 'tactical', positionGroup: 'GK', title: 'Communicates with defence about positioning' },
  { category: 'tactical', positionGroup: 'GK', title: 'Decides when to come off the line' },
  { category: 'tactical', positionGroup: 'GK', title: 'Organises the wall for free kicks' },

  // All Positions - Physical
  { category: 'physical', positionGroup: 'all', title: 'Maintains effort levels for the full match' },
  { category: 'physical', positionGroup: 'all', title: 'Shows acceleration in short sprints' },
  { category: 'physical', positionGroup: 'all', title: 'Demonstrates balance when turning' },
  { category: 'physical', positionGroup: 'all', title: 'Recovers quickly after sprinting' },
  { category: 'physical', positionGroup: 'all', title: 'Shows strength in 50/50 challenges' },

  // All Positions - Psychological
  { category: 'psychological', positionGroup: 'all', title: 'Shows confidence to receive the ball under pressure' },
  { category: 'psychological', positionGroup: 'all', title: 'Encourages teammates vocally' },
  { category: 'psychological', positionGroup: 'all', title: 'Recovers positively from mistakes' },
  { category: 'psychological', positionGroup: 'all', title: 'Shows leadership when the team is losing' },
  { category: 'psychological', positionGroup: 'all', title: 'Stays focused for the entire match' },
  { category: 'psychological', positionGroup: 'all', title: 'Tries new skills without fear of failure' },
  { category: 'psychological', positionGroup: 'all', title: 'Listens to coaching instructions and applies them' },
];

export class DevelopmentService {
  // === Goals ===

  async getPlayerGoals(playerId: string, includeAchieved = true): Promise<DevelopmentGoalRow[]> {
    if (includeAchieved) {
      return developmentRepository.findGoalsByPlayer(playerId);
    }
    return developmentRepository.findActiveGoalsByPlayer(playerId);
  }

  async createGoal(data: CreateGoalData): Promise<ServiceResult<DevelopmentGoalRow>> {
    const goal = await developmentRepository.createGoal(data);
    return { success: true, data: goal };
  }

  async updateGoalStatus(goalId: string, status: string): Promise<ServiceResult<DevelopmentGoalRow>> {
    const validStatuses = ['working_on_it', 'improving', 'achieved'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: { code: 'INVALID_STATUS', message: `Status must be: ${validStatuses.join(', ')}` } };
    }
    const updated = await developmentRepository.updateGoalStatus(goalId, status);
    if (!updated) {
      return { success: false, error: { code: 'GOAL_NOT_FOUND', message: 'Development goal not found.' } };
    }

    // Check development badges when a goal is achieved
    if (status === 'achieved') {
      try {
        const { badgeService, AUTO_BADGES } = await import('./badge.service.js');
        const { db } = await import('../db/index.js');
        const { developmentGoals, players } = await import('../db/schema.js');
        const { eq } = await import('drizzle-orm');

        // Get the player and their positions
        const [player] = await db.select().from(players).where(eq(players.id, updated.playerId)).limit(1);
        if (player) {
          const playerPositions = [player.primaryPosition, player.secondaryPosition, player.tertiaryPosition, 'all'].filter(Boolean);

          // Get all achieved goals for this player that match their positions
          const allGoals = await db.select().from(developmentGoals).where(eq(developmentGoals.playerId, updated.playerId));
          const achievedGoals = allGoals.filter(g => g.status === 'achieved' && playerPositions.includes(g.positionGroup));

          // Dev Star — first achievement
          if (achievedGoals.length === 1) {
            const b = AUTO_BADGES.dev_star;
            await badgeService.awardBadge({ playerId: updated.playerId, clubId: player.clubId ?? undefined, badgeType: 'dev_star', title: b.title, emoji: b.emoji, description: b.description });
          }

          // Scholar — 5 relevant achievements
          if (achievedGoals.length === 5) {
            await badgeService.awardBadge({ playerId: updated.playerId, clubId: player.clubId ?? undefined, badgeType: 'scholar', title: 'Scholar', emoji: '🎓', description: 'Achieved 5 development goals' });
          }

          // Position Master — all goals in a category for their primary position
          const primaryPosGoals = allGoals.filter(g => g.positionGroup === player.primaryPosition);
          const categories = [...new Set(primaryPosGoals.map(g => g.category))];
          for (const cat of categories) {
            const catGoals = primaryPosGoals.filter(g => g.category === cat);
            const catAchieved = catGoals.filter(g => g.status === 'achieved');
            if (catGoals.length > 0 && catAchieved.length === catGoals.length) {
              const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
              await badgeService.awardBadge({
                playerId: updated.playerId, clubId: player.clubId ?? undefined,
                badgeType: `position_master_${cat}`, title: `${catLabel} Master`, emoji: '🏅',
                description: `Completed all ${catLabel.toLowerCase()} goals for ${player.primaryPosition}`,
              });
            }
          }
        }
      } catch (err) {
        console.error('[Development] Badge check failed:', err);
      }
    }

    return { success: true, data: updated };
  }

  async deleteGoal(goalId: string): Promise<ServiceResult<{ message: string }>> {
    await developmentRepository.deleteGoal(goalId);
    return { success: true, data: { message: 'Goal deleted.' } };
  }

  // === Observations ===

  async getGoalObservations(goalId: string): Promise<DevelopmentObservationRow[]> {
    return developmentRepository.findObservationsByGoal(goalId);
  }

  async getPlayerObservations(playerId: string): Promise<DevelopmentObservationRow[]> {
    return developmentRepository.findObservationsByPlayer(playerId);
  }

  async addObservation(data: CreateObservationData): Promise<ServiceResult<DevelopmentObservationRow>> {
    if (!data.observation.trim()) {
      return { success: false, error: { code: 'EMPTY_OBSERVATION', message: 'Observation text is required.' } };
    }
    const obs = await developmentRepository.createObservation(data);
    return { success: true, data: obs };
  }

  // === Library ===

  async getLibrary(positionGroup?: string, category?: string): Promise<GoalLibraryRow[]> {
    return developmentRepository.findLibraryGoals(positionGroup, category);
  }

  async addCustomLibraryGoal(data: { category: string; positionGroup: string; title: string; description?: string }): Promise<ServiceResult<GoalLibraryRow>> {
    const goal = await developmentRepository.createLibraryGoal(data);
    return { success: true, data: goal };
  }

  async seedLibrary(): Promise<void> {
    await developmentRepository.seedLibrary(GOAL_LIBRARY_SEED);
  }
}

export const developmentService = new DevelopmentService();
