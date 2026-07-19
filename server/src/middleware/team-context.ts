import { db } from '../db/index.js';
import { seasons } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Request } from 'express';

/**
 * Team Context helpers.
 * Priority:
 * 1. X-Club-Id header (admin switching teams)
 * 2. User's first clubId from token (coach/parent/scout)
 * 3. undefined (no filter — backwards compat)
 */

/**
 * Get the effective clubId for this request.
 * Admins use X-Club-Id header. Non-admins use their token's first clubId.
 */
export function getClubId(req: Request): string | undefined {
  // First check header (admin team switching)
  const headerClub = req.headers['x-club-id'] as string | undefined;
  if (headerClub) return headerClub;

  // Fallback to user's own club from token (for coaches/parents/scouts)
  if (req.user && req.user.clubIds && req.user.clubIds.length > 0) {
    return req.user.clubIds[0];
  }

  return undefined;
}

/**
 * Get the active seasonId for the resolved club.
 */
export async function getActiveSeasonId(req: Request): Promise<string | undefined> {
  const clubId = getClubId(req);
  if (!clubId) return undefined;

  const [season] = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.clubId, clubId), eq(seasons.isActive, true)))
    .limit(1);

  return season?.id;
}
