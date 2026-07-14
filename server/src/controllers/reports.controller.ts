import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { reportsService } from '../services/reports.service.js';

type Request = ExpressRequest<{ playerId?: string }>;

/**
 * Reports Controller
 */

export class ReportsController {
  async getPlayingTime(_req: Request, res: Response): Promise<void> {
    const report = await reportsService.getPlayingTimeSummary();
    res.json({ data: report });
  }

  async getAttendance(_req: Request, res: Response): Promise<void> {
    const report = await reportsService.getAttendanceReport();
    res.json({ data: report });
  }

  async getPlayerReport(req: Request, res: Response): Promise<void> {
    const playerId = req.params.playerId!;
    const report = await reportsService.getPlayerReportCard(playerId);
    if (!report) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Player not found.' });
      return;
    }
    res.json({ data: report });
  }

  async getSeasonResults(_req: Request, res: Response): Promise<void> {
    const report = await reportsService.getSeasonResults();
    res.json({ data: report });
  }

  async getGkRotation(_req: Request, res: Response): Promise<void> {
    const report = await reportsService.getGkRotationReport();
    res.json({ data: report });
  }

  async getDevelopmentProgress(_req: Request, res: Response): Promise<void> {
    const report = await reportsService.getDevelopmentProgressReport();
    res.json({ data: report });
  }
}

export const reportsController = new ReportsController();
