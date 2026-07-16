import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { playerService } from '../services/player.service.js';
import { createPlayerSchema, updatePlayerSchema } from '../validation/player.validation.js';
import { getClubId } from '../middleware/team-context.js';

// Use a simpler request type that doesn't cause issues with params
type Request = ExpressRequest<{ id?: string }>;

/**
 * Player Controller - Handles HTTP requests for player management.
 * Validates input, delegates to service layer, formats responses.
 */

export class PlayerController {
  /**
   * GET /api/players
   * List all players. Query param ?includeInactive=true to include inactive.
   * Filters by X-Club-Id header when present.
   */
  async getAll(req: Request, res: Response): Promise<void> {
    const includeInactive = req.query.includeInactive === 'true';
    const clubId = getClubId(req);
    const players = await playerService.getAllPlayers(includeInactive, clubId);
    res.json({ data: players, count: players.length });
  }

  /**
   * GET /api/players/:id
   * Get a single player by ID.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await playerService.getPlayerById(id);

    if (!result.success) {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/players
   * Create a new player. Attaches the X-Club-Id header as the player's club.
   */
  async create(req: Request, res: Response): Promise<void> {
    // Validate request body
    const parsed = createPlayerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid player data.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const clubId = getClubId(req);
    const result = await playerService.createPlayer({ ...parsed.data, clubId });

    if (!result.success) {
      const statusCode = result.error.code === 'SHIRT_NUMBER_TAKEN' ? 409 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.status(201).json({ data: result.data });
  }

  /**
   * PUT /api/players/:id
   * Update an existing player.
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    // Validate request body
    const parsed = updatePlayerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid player data.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await playerService.updatePlayer(id, parsed.data);

    if (!result.success) {
      const statusCode = result.error.code === 'PLAYER_NOT_FOUND' ? 404 :
                          result.error.code === 'SHIRT_NUMBER_TAKEN' ? 409 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * DELETE /api/players/:id
   * Soft delete (deactivate) a player.
   */
  async deactivate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await playerService.deactivatePlayer(id);

    if (!result.success) {
      const statusCode = result.error.code === 'PLAYER_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/players/:id/reactivate
   * Reactivate a previously deactivated player.
   */
  async reactivate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await playerService.reactivatePlayer(id);

    if (!result.success) {
      const statusCode = result.error.code === 'PLAYER_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }
}

// Singleton instance
export const playerController = new PlayerController();
