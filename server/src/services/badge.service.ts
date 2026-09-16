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

  // Player of the Match (repeatable, once per match)
  motm: { title: 'Player of the Match', emoji: '🏆', description: 'Named Player of the Match', tier: 'silver', points: 20 },

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

  // Clean sheets (season-scoped tiers) — a clean-sheet QUARTER played (any position)
  clean_sheet: { title: 'Clean Sheet', emoji: '🧤', description: 'A clean-sheet quarter played', tier: 'bronze', points: 15 },
  clean_sheets_5: { title: '5 Clean Sheets', emoji: '🛡️', description: '5 clean-sheet quarters this season', tier: 'silver', points: 30 },
  clean_sheets_10: { title: '10 Clean Sheets', emoji: '🏰', description: '10 clean-sheet quarters this season', tier: 'gold', points: 45 },
  clean_sheets_15: { title: '15 Clean Sheets', emoji: '🏯', description: '15 clean-sheet quarters this season', tier: 'gold', points: 55 },
  clean_sheets_20: { title: '20 Clean Sheets', emoji: '🧱', description: '20 clean-sheet quarters this season', tier: 'platinum', points: 70 },

  // Defensive clean sheets — clean-sheet quarters played in a DEFENDING position
  def_clean_sheets_5: { title: 'Defensive Wall', emoji: '🚧', description: '5 clean-sheet quarters as a defender this season', tier: 'silver', points: 30 },
  def_clean_sheets_10: { title: 'Back-line Rock', emoji: '🪨', description: '10 clean-sheet quarters as a defender this season', tier: 'gold', points: 55 },

  // Goalkeeper shutouts — quarters in goal with no goal conceded that quarter
  gk_shutout: { title: 'Shutout', emoji: '🧤', description: 'A quarter kept clean in goal', tier: 'bronze', points: 18 },
  gk_shutouts_5: { title: '5 Shutouts', emoji: '🥅', description: '5 shutout quarters in goal this season', tier: 'silver', points: 35 },
  gk_shutouts_10: { title: '10 Shutouts', emoji: '🧤', description: '10 shutout quarters in goal this season', tier: 'gold', points: 60 },

  // Goalkeeper minutes (career)
  gk_mins_100: { title: 'Brave Keeper', emoji: '🧤', description: '100 minutes in goal', tier: 'silver', points: 25 },
  gk_mins_250: { title: 'Safe Hands', emoji: '🥅', description: '250 minutes in goal', tier: 'gold', points: 50 },

  // Total minutes / commitment (career)
  mins_250: { title: '250 Minutes', emoji: '⏱️', description: '250 total minutes played', tier: 'bronze', points: 20 },
  mins_500: { title: '500 Minutes', emoji: '⏰', description: '500 total minutes played', tier: 'silver', points: 40 },
  ever_present: { title: 'Ever-present', emoji: '📅', description: 'Played 5 matches in a row', tier: 'silver', points: 30 },

  // Versatility
  utility_player: { title: 'Utility Player', emoji: '🧰', description: 'Played 3+ different positions this season', tier: 'silver', points: 30 },
  all_rounder: { title: 'All-rounder', emoji: '🌐', description: 'Played in defence, midfield, attack and goal', tier: 'gold', points: 45 },

  // Development
  dev_star: { title: 'Development Star', emoji: '⭐', description: 'Achieved a development goal', tier: 'silver', points: 25 },
};

// Position → zone mapping for defensive / all-rounder badges
const POSITION_ZONE: Record<string, 'defence' | 'midfield' | 'attack' | 'gk'> = {
  GK: 'gk',
  CB: 'defence', LB: 'defence', RB: 'defence', LCB: 'defence', RCB: 'defence', LWB: 'defence', RWB: 'defence',
  CM: 'midfield', LM: 'midfield', RM: 'midfield', LCM: 'midfield', RCM: 'midfield',
  CF: 'attack', ST: 'attack',
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

  /** Delete a badge by id */
  async deleteBadge(badgeId: string) {
    await db.delete(badges).where(eq(badges.id, badgeId));
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

    // ── Per-quarter defensive / GK badges (season-scoped) ──
    // Load season match results + playing time once for season totals.
    const allResults = await db.select().from(matchResults);
    const allPlayingTime = await db.select().from(playingTime);
    const inSeason = (fid: string) => seasonFixtureIds.size === 0 || seasonFixtureIds.has(fid);

    // Helper: for a fixture, which periods did the opponent NOT score in?
    const cleanPeriodsFor = (fid: string): Set<number> => {
      const r = allResults.find((x) => x.fixtureId === fid);
      const set = new Set<number>();
      if (r?.periodScores) {
        try {
          const scores = JSON.parse(r.periodScores) as { period: number; goalsFor: number; goalsAgainst: number }[];
          for (const ps of scores) if ((ps.goalsAgainst ?? 0) === 0) set.add(ps.period);
        } catch { /* no per-period data */ }
      }
      return set;
    };

    // Count season totals of clean-sheet quarters (any / defensive) and GK shutout quarters for a player.
    const seasonQuarterTotals = (pid: string) => {
      let cs = 0, defCs = 0, gkShut = 0;
      for (const p of allPlayingTime) {
        if (p.playerId !== pid || !inSeason(p.fixtureId)) continue;
        const cleanPeriods = cleanPeriodsFor(p.fixtureId);
        if (cleanPeriods.size === 0 || !p.periodsDetail) continue;
        let detail: { period: number; minutes: number; position: string; isGk: boolean }[] = [];
        try { detail = JSON.parse(p.periodsDetail); } catch { continue; }
        // group minutes/position by period
        for (const period of cleanPeriods) {
          const segs = detail.filter((d) => d.period === period);
          if (segs.length === 0) continue;
          const played = segs.reduce((s, d) => s + (d.minutes ?? 0), 0);
          // must have played the full quarter to earn credit (consistent with stats)
          // approximate full quarter as any segment covering the period; use minutes>0 + on for whole
          if (played <= 0) continue;
          cs++;
          if (segs.some((d) => d.isGk)) gkShut++;
          else if (segs.some((d) => POSITION_ZONE[d.position] === 'defence')) defCs++;
        }
      }
      return { cs, defCs, gkShut };
    };

    // Award for players who featured this match
    for (const pt of fixturePlayingTime) {
      if (pt.totalMinutes <= 0) continue;
      const pid = pt.playerId;
      const cleanPeriods = cleanPeriodsFor(fixtureId);

      // Did this player earn any clean-sheet / shutout quarter THIS match? (for repeatable per-match badges)
      let earnedCleanThisMatch = false, earnedGkShutThisMatch = false;
      if (cleanPeriods.size > 0 && pt.periodsDetail) {
        try {
          const detail = JSON.parse(pt.periodsDetail) as { period: number; minutes: number; position: string; isGk: boolean }[];
          for (const period of cleanPeriods) {
            const segs = detail.filter((d) => d.period === period);
            if (segs.reduce((s, d) => s + (d.minutes ?? 0), 0) <= 0) continue;
            earnedCleanThisMatch = true;
            if (segs.some((d) => d.isGk)) earnedGkShutThisMatch = true;
          }
        } catch { /* ignore */ }
      }

      if (earnedCleanThisMatch) await this.awardAuto('clean_sheet', pid, clubId, seasonId, fixtureId, { repeatable: true });
      if (earnedGkShutThisMatch) await this.awardAuto('gk_shutout', pid, clubId, seasonId, fixtureId, { repeatable: true });

      // Season tier totals
      const { cs, defCs, gkShut } = seasonQuarterTotals(pid);
      if (cs >= 5) await this.awardAuto('clean_sheets_5', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (cs >= 10) await this.awardAuto('clean_sheets_10', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (cs >= 15) await this.awardAuto('clean_sheets_15', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (cs >= 20) await this.awardAuto('clean_sheets_20', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (defCs >= 5) await this.awardAuto('def_clean_sheets_5', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (defCs >= 10) await this.awardAuto('def_clean_sheets_10', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (gkShut >= 5) await this.awardAuto('gk_shutouts_5', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (gkShut >= 10) await this.awardAuto('gk_shutouts_10', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });

      // GK minutes (career)
      const careerGkMins = allPlayingTime.filter((p) => p.playerId === pid).reduce((s, p) => s + p.goalkeeperMinutes, 0);
      if (careerGkMins >= 100) await this.awardAuto('gk_mins_100', pid, clubId, seasonId, fixtureId);
      if (careerGkMins >= 250) await this.awardAuto('gk_mins_250', pid, clubId, seasonId, fixtureId);

      // Total minutes (career)
      const careerMins = allPlayingTime.filter((p) => p.playerId === pid).reduce((s, p) => s + p.totalMinutes, 0);
      if (careerMins >= 250) await this.awardAuto('mins_250', pid, clubId, seasonId, fixtureId);
      if (careerMins >= 500) await this.awardAuto('mins_500', pid, clubId, seasonId, fixtureId);

      // Versatility (season): distinct positions + all-rounder zones
      const zones = new Set<string>();
      const positions = new Set<string>();
      for (const p of allPlayingTime) {
        if (p.playerId !== pid || !inSeason(p.fixtureId) || !p.positionsPlayed) continue;
        try {
          for (const pos of JSON.parse(p.positionsPlayed) as string[]) {
            if (!pos) continue;
            positions.add(pos);
            const z = POSITION_ZONE[pos]; if (z) zones.add(z);
          }
        } catch { /* ignore */ }
      }
      if (positions.size >= 3) await this.awardAuto('utility_player', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      if (zones.has('defence') && zones.has('midfield') && zones.has('attack') && zones.has('gk')) {
        await this.awardAuto('all_rounder', pid, clubId, seasonId, fixtureId, { seasonScopedUnique: true });
      }
    }

    // ── Ever-present: played the last 5 completed match fixtures in a row (career) ──
    const completedMatchFixtures = (await db.select().from(fixtures))
      .filter((f) => f.status === 'completed' && f.type !== 'training' && inSeason(f.id))
      .sort((a, b) => b.date.localeCompare(a.date)); // most recent first
    if (completedMatchFixtures.length >= 5) {
      const lastFive = completedMatchFixtures.slice(0, 5).map((f) => f.id);
      for (const pt of fixturePlayingTime) {
        if (pt.totalMinutes <= 0) continue;
        const pid = pt.playerId;
        const playedAll = lastFive.every((fid) =>
          allPlayingTime.some((p) => p.playerId === pid && p.fixtureId === fid && p.totalMinutes > 0)
        );
        if (playedAll) await this.awardAuto('ever_present', pid, clubId, seasonId, fixtureId);
      }
    }
  }
}

export const badgeService = new BadgeService();
