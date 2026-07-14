import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { developmentService } from '../services/development.service.js';

type Request = ExpressRequest<{ playerId?: string; goalId?: string }>;

/**
 * Development Controller - Player development goals, observations, and goal library.
 */

export class DevelopmentController {
  // === Player Goals ===

  async getPlayerGoals(req: Request, res: Response): Promise<void> {
    const playerId = req.params.playerId!;
    const goals = await developmentService.getPlayerGoals(playerId);
    const observations = await developmentService.getPlayerObservations(playerId);
    res.json({ data: { goals, observations } });
  }

  async createGoal(req: Request, res: Response): Promise<void> {
    const playerId = req.params.playerId!;
    const { category, positionGroup, title, description, seasonId, targetDate } = req.body;

    if (!category || !positionGroup || !title) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'category, positionGroup, and title are required.' });
      return;
    }

    const result = await developmentService.createGoal({
      playerId, category, positionGroup, title, description, seasonId, targetDate,
    });
    res.status(201).json({ data: result.data });
  }

  async updateGoalStatus(req: Request, res: Response): Promise<void> {
    const goalId = req.params.goalId!;
    const { status } = req.body;

    const result = await developmentService.updateGoalStatus(goalId, status);
    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }
    res.json({ data: result.data });
  }

  async deleteGoal(req: Request, res: Response): Promise<void> {
    const goalId = req.params.goalId!;
    await developmentService.deleteGoal(goalId);
    res.json({ data: { message: 'Goal deleted.' } });
  }

  // === Observations ===

  async addObservation(req: Request, res: Response): Promise<void> {
    const goalId = req.params.goalId;
    const playerId = req.params.playerId!;
    const { observation, observedAt, fixtureId } = req.body;

    if (!observation) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'observation text is required.' });
      return;
    }

    const result = await developmentService.addObservation({
      goalId: goalId || undefined,
      playerId,
      fixtureId,
      observation,
      observedAt: observedAt || new Date().toISOString(),
    });

    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }
    res.status(201).json({ data: result.data });
  }

  // === Library ===

  async getLibrary(req: Request, res: Response): Promise<void> {
    const positionGroup = req.query.positionGroup ? String(req.query.positionGroup) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const library = await developmentService.getLibrary(positionGroup, category);
    res.json({ data: library, count: library.length });
  }

  async addLibraryGoal(req: Request, res: Response): Promise<void> {
    const { category, positionGroup, title, description } = req.body;
    if (!category || !positionGroup || !title) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'category, positionGroup, and title are required.' });
      return;
    }
    const result = await developmentService.addCustomLibraryGoal({ category, positionGroup, title, description });
    res.status(201).json({ data: result.data });
  }

  async seedLibrary(_req: Request, res: Response): Promise<void> {
    await developmentService.seedLibrary();
    const library = await developmentService.getLibrary();
    res.json({ data: library, count: library.length, message: 'Library seeded.' });
  }
}

export const developmentController = new DevelopmentController();
