import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { dashboardService } from '../services/dashboard.service.js';

type Request = ExpressRequest;

export class DashboardController {
  async getDashboard(req: Request, res: Response): Promise<void> {
    const clubId = req.headers['x-club-id'] as string | undefined;
    const data = await dashboardService.getDashboardData(clubId);
    res.json({ data });
  }
}

export const dashboardController = new DashboardController();
