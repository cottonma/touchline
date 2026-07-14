import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { dashboardService } from '../services/dashboard.service.js';

type Request = ExpressRequest;

export class DashboardController {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    const data = await dashboardService.getDashboardData();
    res.json({ data });
  }
}

export const dashboardController = new DashboardController();
