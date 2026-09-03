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

// Coach awards a badge (character/effort — once-only per player)
router.post('/award', asyncHandler(async (req, res) => {
  const { playerId, badgeType } = req.body;
  const clubId = getClubId(req);
  const userId = req.user?.userId;

  if (!playerId || !badgeType) {
    res.status(400).json({ error: 'playerId and badgeType are required' });
    return;
  }

  // Look up the template so points/tier/title come from the server, not the client
  const template = COACH_BADGE_TEMPLATES.find((t) => t.type === badgeType);
  if (!template) {
    res.status(400).json({ error: 'Unknown badge type' });
    return;
  }

  const awarded = await badgeService.awardBadge({
    playerId,
    clubId,
    badgeType,
    title: template.title,
    emoji: template.emoji,
    description: template.description,
    tier: template.tier,
    points: template.points,
    awardedBy: userId,
    // Coach character badges are once-only (a player "graduates")
    repeatable: false,
  });

  res.status(201).json({ data: { awarded } });
}));

// Delete a badge (admin/coach)
router.delete('/:badgeId', asyncHandler(async (req, res) => {
  const { badgeId } = req.params;
  await badgeService.deleteBadge(badgeId!);
  res.json({ data: { success: true } });
}));

export const badgeRoutes = router;
