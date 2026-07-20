import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { badgeService, COACH_BADGE_TEMPLATES } from '../services/badge.service.js';
import { getClubId } from '../middleware/team-context.js';

/**
 * Badge API Routes
 *
 * GET  /api/badges/player/:playerId - Get all badges for a player
 * GET  /api/badges/templates        - Get coach-awardable badge templates
 * POST /api/badges/award            - Coach awards a badge to a player
 */

const router = Router();

// Get badges for a player
router.get('/player/:playerId', asyncHandler(async (req, res) => {
  const { playerId } = req.params;
  const playerBadges = await badgeService.getPlayerBadges(playerId!);
  res.json({ data: playerBadges });
}));

// Get coach badge templates
router.get('/templates', asyncHandler(async (_req, res) => {
  res.json({ data: COACH_BADGE_TEMPLATES });
}));

// Coach awards a badge
router.post('/award', asyncHandler(async (req, res) => {
  const { playerId, badgeType, title, emoji, description } = req.body;
  const clubId = getClubId(req);
  const userId = req.user?.userId;

  if (!playerId || !badgeType || !title || !emoji) {
    res.status(400).json({ error: 'playerId, badgeType, title, and emoji are required' });
    return;
  }

  const awarded = await badgeService.awardBadge({
    playerId,
    clubId,
    badgeType,
    title,
    emoji,
    description,
    awardedBy: userId,
  });

  res.status(201).json({ data: { awarded } });
}));

export const badgeRoutes = router;
