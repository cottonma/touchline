import { db } from '../db/index.js';
import { badges, players, playingTime, goals, matchResults, fixtures, seasons } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface BadgeDef {
  title: string;
  emoji: string;
  description: string;
  tier: BadgeTier;
  points: number;
}

/**
 * Automatic badges — awarded by the app on milestones.
 * Points are balanced so scoring does NOT dominate; character/effort badges
 * (coach-awarded) are worth as much as goals.
 */
export const AUTO_BADGES: Record<string, BadgeDef> = {
  // Appearances (career milestones)
  first_match: { title: 'First Match', emoji: '⚽', description: 'Played their first match', tier: 'bronze', points: 10 },
  ten_appearances: { title: '10 Appearances', emoji: '🔟', description: 'Played in 10 matches', tier: 'silver', points: 25 },
  twentyfive_appearances: { title: '25 Appearances', emoji: '🎖️', description: 'Played in 25 matches', tier: 'gold', points: 50 },
  fifty_appearances: { title: '50 Appearances', emoji: '🏅', description: 'Played in 50 matches', tier: 'platinum', points: 100 },

  // Man of the Match (repeatable, once per match)
  motm: { title: 'Man of the Match', emoji: '🏆', description: 'Named Man of the Match', tier: 'silver', points: 20 },

  // Goals (season-scoped tiers) — modest points so scoring isn't over-rewarded
  first_goal: { title: 'First Goal', emoji: '🎯', description: 'Scored their first goal this season', tier: 'bronze', points: 12 },
  goals_5: { title: '5 Goals', emoji: '⚽', description: 'Scored 5 goals this season', tier: 'bronze', points: 18 },
  goals_10: { title: '10 Goals', emoji: '🔥', description: 'Scored 10 goals this season', tier: 'silver', points: 28 },
  goals_15: { title: '15 Goals', emoji: '💥', description: 'Scored 15 goals this season', tier: 'silver', points: 36 },
  goals_20: { title: '20 Goals', emoji: '🌟', description: 'Scored 20 goals this season', tier: 'gold', points: 45 },
  hat_trick: { title: 'Hat-trick Hero', emoji: '🎩', description: 'Scored 3 goals in one match', tier: 'gold', points: 25 },

  // Assists (season-scoped tiers) — same weighting as goals
  first_assist: { title: 'First Assist', emoji: '🤝', description: 'Made their first assist this season', tier: 'bronze', points: 12 },
  assists_5: { title: '5 Assists', emoji: '🅰️', description: '5 assists this season', tier: 'bronze', points: 18 },
  assists_10: { title: '10 Assists', emoji: '🎈', description: '10 assists this season', tier: 'silver', points: 28 },
  assists_15: { title: '15 Assists', emoji: '✨', description: '15 assists this season', tier: 'silver', points: 36 },
  assists_20: { title: '20 Assists', emoji: '🎇', description: '20 assists this season', tier: 'gold', points: 45 },
  playmaker: { title: 'Playmaker', emoji: '🪄', description: '3 assists in one match', tier: 'gold', points: 25 },

  // Clean sheets (season-scoped tiers)
  clean_sheet: { title: 'Clean Sheet', emoji: '🧤', description: 'Kept a clean sheet', tier: 'bronze', points: 15 },
  clean_sheets_5: { title: '5 Clean Sheets', emoji: '🛡️', description: '5 clean sheets this season', tier: 'silver', points: 30 },
  clean_sheets_10: { title: '10 Clean Sheets', emoji: '🏰', description: '10 clean sheets this season', tier: 'gold', points: 60 },

  // Development
  dev_star: { title: 'Development Star', emoji: '⭐', description: 'Achieved a development goal', tier: 'silver', points: 25 },
};

/**
 * Coach-awardable character & effort badges.
 * ONCE-ONLY per player (a player "graduates" — they've shown they get it and
 * now do it naturally). Weighted to match scoring so quieter players can build
 * a strong cabinet through attitude and effort.
 */
export const COACH_BADGE_TEMPLATES: (BadgeDef & { type: string })[] = [
  { type: 'team_captain', title: 'Team Captain', emoji: '👑', description: 'Leads and organises — shouts instructions consistently', tier: 'gold', points: 40 },
  { type: 'encourager', title: 'Encourager', emoji: '📣', description: 'Consistently supports and lifts teammates', tier: 'silver', points: 30 },
  { type: 'support_play', title: 'Great Support Play', emoji: '🔗', description: 'Backs up teammates and moves to help', tier: 'silver', points: 30 },
  { type: 'never_gives_up', title: 'Never Gives Up', emoji: '🦁', description: 'Outstanding resilience and work rate', tier: 'silver', points: 30 },
  { type: 'great_listener', title: 'Great Listener', emoji: '👂', description: 'Takes on and applies coaching points', tier: 'silver', points: 25 },
  { type: 'brave_performance', title: 'Brave Performance', emoji: '💪', description: 'Showed real courage on the ball and in the tackle', tier: 'silver', points: 30 },
  { type: 'most_improved', title: 'Most Improved', emoji: '📈', description: 'Showed the most improvement', tier: 'gold', points: 40 },
  { type: 'skills_star', title: 'Skills Star', emoji: '🎪', description: 'Excellent technical skill on show', tier: 'silver', points: 25 },
  { type: 'team_spirit', title: 'Team Spirit', emoji: '🤜', description: 'Brilliant teamwork and attitude', tier: 'silver', points: 25 },
  { type: 'training_star', title: 'Training Star', emoji: '🏋️', description: 'Outstanding effort in training', tier: 'bronze', points: 15 },
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

  /** Check if a player already has a specific badge type (optionally within a season) */
  async hasBadge(playerId: string, badgeType: string, seasonId?: string): Promise<boolean> {
    const rows = await db.select({ id: badges.id, seasonId: badges.seasonId }).from(badges)
      .where(and(eq(badges.playerId, playerId), eq(badges.badgeType, badgeType)));
    if (seasonId) return rows.some((r) => r.seasonId === seasonId);
    return rows.length > 0;
  }

  /** Resolve the active season id for a club. */
  private async activeSeasonId(clubId?: string): Promise<string | undefined> {
    if (!clubId) return undefined;
    const clubSeasons = await db.select().from(seasons).where(eq(seasons.clubId, clubId));
    const active = clubSeasons.find((s) => s.isActive);
    return active?.id ?? [...clubSeasons].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0]?.id;
  }

  /** Award a badge (respecting once-only rules). */
  async awardBadge(params: {
    playerId: string;
    clubId?: string;
    seasonId?: string;
    badgeType: string;
    title: string;
    emoji: string;
    description?: string;
    tier?: BadgeTier;
    points?: number;
    awardedBy?: string;
    fixtureId?: string;
    /** If true, allow multiple of this badge type (e.g. MOTM, hat-trick). */
    repeatable?: boolean;
    /** Scope the once-only check to a season (for season-tiered milestones). */
    seasonScopedUnique?: boolean;
  }): Promise<boolean> {
    if (!params.repeatable) {
      const has = await this.hasBadge(params.playerId, params.badgeType, params.seasonScopedUnique ? params.seasonId : undefined);
      if (has) return false;
    }

    await db.insert(badges).values({
      id: nanoid(),
      playerId: params.playerId,
      clubId: params.clubId ?? null,
      seasonId: params.seasonId ?? null,
      badgeType: params.badgeType,
      title: params.title,
      emoji: params.emoji,
      description: params.description ?? null,
      tier: params.tier ?? 'bronze',
      points: params.points ?? 0,
      awardedBy: params.awardedBy ?? null,
      fixtureId: params.fixtureId ?? null,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  /** Convenience: award an AUTO_BADGES entry by key. */
  private async awardAuto(key: keyof typeof AUTO_BADGES, playerId: string, clubId: string | undefined, seasonId: string | undefined, fixtureId?: string, opts?: { repeatable?: boolean; seasonScopedUnique?: boolean }) {
    const b = AUTO_BADGES[key];
    return this.awardBadge({
      playerId, clubId, seasonId, badgeType: key,
      title: b.title, emoji: b.emoji, description: b.description, tier: b.tier, points: b.points,
      fixtureId, repeatable: opts?.repeatable, seasonScopedUnique: opts?.seasonScopedUnique,
    });
  }

  /**
   * Check and award automatic badges after a match is recorded.
   * Goals/assists/clean-sheet tiers are SEASON-scoped.
   */
  async checkAutoBadges(fixtureId: string, clubId?: string) {
    const seasonId = await this.activeSeasonId(clubId);

    // Season fixture ids (for season-scoped goal/assist/clean-sheet totals)
    let seasonFixtureIds = new Set<string>();
    if (seasonId) {
      const seasonFixtures = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.seasonId, seasonId));
      seasonFixtureIds = new Set(seasonFixtures.map((f) => f.id));
    }

    const fixturePlayingTime = await db.select().from(playingTime).where(eq(playingTime.fixtureId, fixtureId));
    const fixtureGoals = await db.select().from(goals).where(eq(goals.fixtureId, fixtureId));

    // --- Appearances (career milestones) ---
    for (const pt of fixturePlayingTime) {
      if (pt.totalMinutes <= 0) continue;
      const pid = pt.playerId;
      const allPt = await db.select({ id: playingTime.id }).from(playingTime).where(eq(playingTime.playerId, pid));
      const matchCount = allPt.length;
      if (matchCount >= 1) await this.awardAuto('first_match', pid, clubId, seasonId, fixtureId);
      if (matchCount >= 10) await this.awardAuto('ten_appearances', pid, clubId, seasonId, fixtureId);
      if (matchCount >= 25) await this.awardAuto('twentyfive_appearances', pid, clubId, seasonId, fixtureId);
      if (matchCount >= 50) await this.awardAuto('fifty_appearances', pid, clubId, seasonId, fixtureId);
    }

    // --- Goals (season-scoped) ---
    const allGoals = await db.select().from(goals);
    const scorersThisMatch = new Map<string, number>();
    for (const g of fixtureGoals) {
      if (g.scorerId) scorersThisMatch.set(g.scorerId, (scorersThisMatch.get(g.scorerId) ?? 0) + 1);
    }
    for (const [scorerId, countThisMatch] of scorersThisMatch) {
      const seasonGoals = allGoals.filter((g) => g.scorerId === scorerId && (seasonFixtureIds.size === 0 || seasonFixtureIds.has(g.fixtureId))).length;
      if (seasonGoals >= 1) await this.awardAuto('first_goal', scorerId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonGoals >= 5) await this.awardAuto('goals_5', scorerId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonGoals >= 10) await this.awardAuto('goals_10', scorerId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonGoals >= 15) await this.awardAuto('goals_15', scorerId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonGoals >= 20) await this.awardAuto('goals_20', scorerId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (countThisMatch >= 3) await this.awardAuto('hat_trick', scorerId, clubId, seasonId, fixtureId, { repeatable: true });
    }

    // --- Assists (season-scoped) ---
    const assistersThisMatch = new Map<string, number>();
    for (const g of fixtureGoals) {
      if (g.assistId) assistersThisMatch.set(g.assistId, (assistersThisMatch.get(g.assistId) ?? 0) + 1);
    }
    for (const [assisterId, countThisMatch] of assistersThisMatch) {
      const seasonAssists = allGoals.filter((g) => g.assistId === assisterId && (seasonFixtureIds.size === 0 || seasonFixtureIds.has(g.fixtureId))).length;
      if (seasonAssists >= 1) await this.awardAuto('first_assist', assisterId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonAssists >= 5) await this.awardAuto('assists_5', assisterId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonAssists >= 10) await this.awardAuto('assists_10', assisterId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonAssists >= 15) await this.awardAuto('assists_15', assisterId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (seasonAssists >= 20) await this.awardAuto('assists_20', assisterId, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (countThisMatch >= 3) await this.awardAuto('playmaker', assisterId, clubId, seasonId, fixtureId, { repeatable: true });
    }

    // --- Clean sheets (season-scoped): only if the team kept a clean sheet this match ---
    const [result] = await db.select().from(matchResults).where(eq(matchResults.fixtureId, fixtureId)).limit(1);
    if (result && result.goalsAgainst === 0) {
      // Award to players who played at least 2 periods in this match
      const cleanSheetPlayers = fixturePlayingTime.filter((pt) => pt.periodsPlayed + pt.periodsInGoal >= 2);
      // Season clean-sheet count per player = matches (season) with GA=0 where they played >=2 periods
      const allResults = await db.select().from(matchResults);
      const allPlayingTime = await db.select().from(playingTime);
      for (const pt of cleanSheetPlayers) {
        const pid = pt.playerId;
        const seasonCleanSheets = allPlayingTime.filter((p) => {
          if (p.playerId !== pid) return false;
          if (seasonFixtureIds.size > 0 && !seasonFixtureIds.has(p.fixtureId)) return false;
          if (p.periodsPlayed + p.periodsInGoal < 2) return false;
          const r = allResults.find((x) => x.fixtureId === p.fixtureId);
          return r && r.goalsAgainst === 0;
        }).length;
        await this.awardAuto('clean_sheet', pid, clubId, seasonId, fixtureId, { repeatable: true });
        if (seasonCleanSheets >= 5) await this.awardAuto('clean_sheets_5', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
        if (seasonCleanSheets >= 10) await this.awardAuto('clean_sheets_10', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      }
    }
  }
}

export const badgeService = new BadgeService();
