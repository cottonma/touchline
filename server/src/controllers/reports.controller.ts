import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { reportsService } from '../services/reports.service.js';

type Request = ExpressRequest<{ playerId?: string }>;

/**
 * Reports Controller
 */

function getClubId(req: Request): string | undefined {
  return req.headers['x-club-id'] as string | undefined;
}

export class ReportsController {
  async getPlayingTime(req: Request, res: Response): Promise<void> {
    const report = await reportsService.getPlayingTimeSummary(getClubId(req));
    res.json({ data: report });
  }

  async getAttendance(req: Request, res: Response): Promise<void> {
    const report = await reportsService.getAttendanceReport(getClubId(req));
    res.json({ data: report });
  }

  async getPlayerReport(req: Request, res: Response): Promise<void> {
    const playerId = req.params.playerId!;
    const report = await reportsService.getPlayerReportCard(playerId, getClubId(req));
    if (!report) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Player not found.' });
      return;
    }
    res.json({ data: report });
  }

  async getSeasonResults(req: Request, res: Response): Promise<void> {
    const report = await reportsService.getSeasonResults(getClubId(req));
    res.json({ data: report });
  }

  async getGkRotation(req: Request, res: Response): Promise<void> {
    const report = await reportsService.getGkRotationReport(getClubId(req));
    res.json({ data: report });
  }

  async getDevelopmentProgress(req: Request, res: Response): Promise<void> {
    const report = await reportsService.getDevelopmentProgressReport(getClubId(req));
    res.json({ data: report });
  }
}

export const reportsController = new ReportsController();
