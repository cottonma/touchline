import { db } from '../db/index.js';
import { badges, players, playingTime, goals, motmVotes } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Badge definitions — automatic badges awarded on milestones.
 */
export const AUTO_BADGES = {
  first_match: { title: 'First Match', emoji: '⚽', description: 'Played their first match' },
  ten_appearances: { title: '10 Appearances', emoji: '🔟', description: 'Played in 10 matches' },
  first_goal: { title: 'First Goal', emoji: '🎯', description: 'Scored their first goal' },
  hat_trick: { title: 'Hat-trick Hero', emoji: '🌟', description: 'Scored 3 goals in one match' },
  first_assist: { title: 'First Assist', emoji: '🤝', description: 'Made their first assist' },
  playmaker: { title: 'Playmaker', emoji: '🎩', description: '5 assists in a season' },
  clean_sheet: { title: 'Clean Sheet', emoji: '🧤', description: 'Kept a clean sheet' },
  motm: { title: 'Man of the Match', emoji: '🏆', description: 'Won Man of the Match' },
  dev_star: { title: 'Development Star', emoji: '⭐', description: 'Achieved a development goal' },
} as const;

/**
 * Coach-awardable badge templates.
 */
export const COACH_BADGE_TEMPLATES = [
  { type: 'best_trainer', title: 'Best Trainer', emoji: '💪', description: 'Outstanding effort in training' },
  { type: 'most_improved', title: 'Most Improved', emoji: '📈', description: 'Showed the most improvement' },
  { type: 'team_spirit', title: 'Team Spirit', emoji: '🤜', description: 'Great teamwork and attitude' },
  { type: 'skills_star', title: 'Skills Star', emoji: '✨', description: 'Demonstrated excellent skills' },
  { type: 'brave_performance', title: 'Brave Performance', emoji: '🦁', description: 'Showed courage and determination' },
  { type: 'leadership', title: 'Leader', emoji: '👑', description: 'Showed leadership qualities' },
];

export class BadgeService {
  /** Get all badges for a player */
  async getPlayerBadges(playerId: string) {
    return db.select().from(badges).where(eq(badges.playerId, playerId));
  }

  /** Get all badges for a club */
  async getClubBadges(clubId: string) {
    return db.select().from(badges).where(eq(badges.clubId, clubId));
  }

  /** Check if a player already has a specific badge type */
  async hasBadge(playerId: string, badgeType: string): Promise<boolean> {
    const existing = await db.select({ id: badges.id }).from(badges)
      .where(and(eq(badges.playerId, playerId), eq(badges.badgeType, badgeType)))
      .limit(1);
    return existing.length > 0;
  }

  /** Award a badge (if not already awarded) */
  async awardBadge(params: {
    playerId: string;
    clubId?: string;
    badgeType: string;
    title: string;
    emoji: string;
    description?: string;
    awardedBy?: string;
    fixtureId?: string;
  }): Promise<boolean> {
    // Don't double-award automatic badges
    if (!params.awardedBy) {
      const has = await this.hasBadge(params.playerId, params.badgeType);
      if (has) return false;
    }

    await db.insert(badges).values({
      id: nanoid(),
      playerId: params.playerId,
      clubId: params.clubId ?? null,
      badgeType: params.badgeType,
      title: params.title,
      emoji: params.emoji,
      description: params.description ?? null,
      awardedBy: params.awardedBy ?? null,
      fixtureId: params.fixtureId ?? null,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Check and award automatic badges after a match is recorded.
   * Call this after match results are saved.
   */
  async checkAutoBadges(fixtureId: string, clubId?: string) {
    // Get all playing time for this fixture
    const fixturePlayingTime = await db.select().from(playingTime).where(eq(playingTime.fixtureId, fixtureId));
    const fixtureGoals = await db.select().from(goals).where(eq(goals.fixtureId, fixtureId));

    for (const pt of fixturePlayingTime) {
      if (pt.totalMinutes <= 0) continue;
      const pid = pt.playerId;

      // First Match
      const allPt = await db.select({ id: playingTime.id }).from(playingTime)
        .where(and(eq(playingTime.playerId, pid)));
      const matchCount = allPt.length;

      if (matchCount === 1) {
        const b = AUTO_BADGES.first_match;
        await this.awardBadge({ playerId: pid, clubId, badgeType: 'first_match', title: b.title, emoji: b.emoji, description: b.description, fixtureId });
      }

      // 10 Appearances
      if (matchCount === 10) {
        const b = AUTO_BADGES.ten_appearances;
        await this.awardBadge({ playerId: pid, clubId, badgeType: 'ten_appearances', title: b.title, emoji: b.emoji, description: b.description, fixtureId });
      }
    }

    // Goals — first goal + hat trick
    const scorerGoals = new Map<string, number>();
    for (const g of fixtureGoals) {
      if (g.scorerId) {
        scorerGoals.set(g.scorerId, (scorerGoals.get(g.scorerId) ?? 0) + 1);
      }
    }

    for (const [scorerId, count] of scorerGoals) {
      // First Goal ever
      const allGoals = await db.select({ id: goals.id }).from(goals).where(eq(goals.scorerId, scorerId));
      if (allGoals.length <= count) {
        // This fixture contains their first goal(s)
        const b = AUTO_BADGES.first_goal;
        await this.awardBadge({ playerId: scorerId, clubId, badgeType: 'first_goal', title: b.title, emoji: b.emoji, description: b.description, fixtureId });
      }

      // Hat trick in this match
      if (count >= 3) {
        const b = AUTO_BADGES.hat_trick;
        // Allow multiple hat-trick badges (one per match)
        await db.insert(badges).values({
          id: nanoid(), playerId: scorerId, clubId: clubId ?? null,
          badgeType: 'hat_trick', title: b.title, emoji: b.emoji,
          description: b.description, awardedBy: null, fixtureId, createdAt: new Date().toISOString(),
        });
      }
    }

    // Assists — first assist + playmaker (5 total)
    const assisters = new Set<string>();
    for (const g of fixtureGoals) {
      if (g.assistPlayerId) assisters.add(g.assistPlayerId);
    }

    for (const assisterId of assisters) {
      const allAssists = await db.select({ id: goals.id }).from(goals).where(eq(goals.assistPlayerId, assisterId));
      const totalAssists = allAssists.length;

      // First Assist
      const fixtureAssists = fixtureGoals.filter(g => g.assistPlayerId === assisterId).length;
      if (totalAssists <= fixtureAssists) {
        const b = AUTO_BADGES.first_assist;
        await this.awardBadge({ playerId: assisterId, clubId, badgeType: 'first_assist', title: b.title, emoji: b.emoji, description: b.description, fixtureId });
      }

      // Playmaker — 5 assists total
      if (totalAssists >= 5) {
        const b = AUTO_BADGES.playmaker;
        await this.awardBadge({ playerId: assisterId, clubId, badgeType: 'playmaker', title: b.title, emoji: b.emoji, description: b.description, fixtureId });
      }
    }

    // Clean sheet — if goals against = 0, award to GK
    const goalsAgainst = fixtureGoals.filter(g => !g.scorerId).length; // This isn't quite right — need match result
    // We'll check from match_results instead
  }
}

export const badgeService = new BadgeService();
