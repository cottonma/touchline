import { db } from '../db/index.js';
import { seasons } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Request } from 'express';

/**
 * Team Context helpers.
 * Extracts the active club/season from the X-Club-Id header
 * sent by the client on every request.
 */

/**
 * Get the clubId from the X-Club-Id request header.
 */
export function getClubId(req: Request): string | undefined {
  return req.headers['x-club-id'] as string | undefined;
}

/**
 * Get the active seasonId for the club specified in the X-Club-Id header.
 * Returns undefined if no header or no active season found.
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
