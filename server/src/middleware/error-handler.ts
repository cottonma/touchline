import type { Request, Response, NextFunction } from 'express';

/**
 * Global Express error-handling middleware.
 * Catches any errors forwarded via next(err) and returns a structured JSON response.
 * Must be registered AFTER all routes.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message, err.stack);

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
  });
}
