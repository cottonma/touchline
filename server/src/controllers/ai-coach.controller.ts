import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { aiCoachService } from '../services/ai-coach.service.js';

type Request = ExpressRequest;

/**
 * AI Coach Controller
 */

export class AiCoachController {
  /**
   * GET /api/ai/status
   * Check if AI is available.
   */
  async getStatus(_req: Request, res: Response): Promise<void> {
    const available = await aiCoachService.isAvailable();
    res.json({ data: { available } });
  }

  /**
   * POST /api/ai/chat
   * Chat with the AI Coach.
   * Body: { message: string, history?: { role, content }[] }
   */
  async chat(req: Request, res: Response): Promise<void> {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'message is required.' });
      return;
    }

    const result = await aiCoachService.chat(message, history);

    if (!result.success) {
      const statusCode = result.error.code === 'AI_UNAVAILABLE' ? 503 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }

  /**
   * POST /api/ai/training-plan
   * Generate a training session plan.
   * Body: { theme: string, durationMinutes?: number }
   */
  async generateTrainingPlan(req: Request, res: Response): Promise<void> {
    const { theme, durationMinutes } = req.body;

    if (!theme || typeof theme !== 'string') {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'theme is required.' });
      return;
    }

    const result = await aiCoachService.generateTrainingPlan(theme, durationMinutes);

    if (!result.success) {
      const statusCode = result.error.code === 'AI_UNAVAILABLE' ? 503 : 400;
      res.status(statusCode).json({ error: result.error.code, message: result.error.message });
      return;
    }

    res.json({ data: result.data });
  }
}

export const aiCoachController = new AiCoachController();
