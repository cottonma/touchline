import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { trainingService } from '../services/training.service.js';

type Request = ExpressRequest<{ id?: string; fixtureId?: string }>;

/**
 * Training Controller
 */

export class TrainingController {
  async getAll(_req: Request, res: Response): Promise<void> {
    const sessions = await trainingService.getAllSessions();
    res.json({ data: sessions, count: sessions.length });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;
    const result = await trainingService.getSessionById(id);
    if (!result.success) {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }
    res.json({ data: result.data });
  }

  async create(req: Request, res: Response): Promise<void> {
    const { fixtureId, theme, objectives, plan, notes, linkedFixtureId } = req.body;
    const result = await trainingService.createSession({ fixtureId, theme, objectives, plan, notes, linkedFixtureId });
    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }
    res.status(201).json({ data: result.data });
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;
    const { theme, objectives, plan, notes, linkedFixtureId } = req.body;
    const result = await trainingService.updateSession(id, { theme, objectives, plan, notes, linkedFixtureId });
    if (!result.success) {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }
    res.json({ data: result.data });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id!;
    await trainingService.deleteSession(id);
    res.json({ data: { message: 'Training session deleted.' } });
  }

  // Attendance
  async getAttendance(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const attendance = await trainingService.getAttendance(fixtureId);
    res.json({ data: attendance });
  }

  async recordAttendance(req: Request, res: Response): Promise<void> {
    const fixtureId = req.params.fixtureId!;
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'items array is required.' });
      return;
    }
    const result = await trainingService.recordAttendance(fixtureId, items);
    if (!result.success) {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }
    res.json({ data: result.data, count: result.data.length });
  }
}

export const trainingController = new TrainingController();
