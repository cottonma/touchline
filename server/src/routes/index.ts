import type { Express } from 'express';
import { authRoutes } from './auth.routes.js';
import { authMiddleware } from '../middleware/auth.js';
import { playerRoutes } from './player.routes.js';
import { fixtureRoutes } from './fixture.routes.js';
import { availabilityRoutes } from './availability.routes.js';
import { policyRoutes } from './policy.routes.js';
import { teamSelectionRoutes } from './team-selection.routes.js';
import { matchDayRoutes } from './match-day.routes.js';
import { statisticsRoutes } from './statistics.routes.js';
import { developmentRoutes } from './development.routes.js';
import { trainingRoutes } from './training.routes.js';
import { reportsRoutes } from './reports.routes.js';
import { aiCoachRoutes } from './ai-coach.routes.js';
import { seasonRoutes } from './season.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { oppositionNotesRoutes } from './opposition-notes.routes.js';
import { scoutReportRoutes } from './scout-report.routes.js';
import { clubRoutes } from './club.routes.js';

/**
 * Register all API routes.
 * Auth routes are public (login), all other routes require authentication.
 */
export function setupRoutes(app: Express): void {
  // Auth routes (login is public, me/register use their own middleware)
  app.use('/api/auth', authRoutes);

  // Apply auth middleware to all routes below this point
  app.use('/api', authMiddleware);

  // Protected routes
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/fixtures', fixtureRoutes);
  app.use('/api/fixtures/:fixtureId/availability', availabilityRoutes);
  app.use('/api/fixtures/:fixtureId/team-selection', teamSelectionRoutes);
  app.use('/api/fixtures/:fixtureId/match-day', matchDayRoutes);
  app.use('/api/stats', statisticsRoutes);
  app.use('/api/development', developmentRoutes);
  app.use('/api/training', trainingRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/ai', aiCoachRoutes);
  app.use('/api/policies', policyRoutes);
  app.use('/api/seasons', seasonRoutes);
  app.use('/api/clubs', clubRoutes);
  app.use('/api/opposition-notes', oppositionNotesRoutes);
  app.use('/api/scout-reports', scoutReportRoutes);

  // 404 handler for unmatched API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'The requested API endpoint does not exist.',
    });
  });
}
