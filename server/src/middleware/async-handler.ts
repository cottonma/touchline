import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to ensure rejected promises
 * are forwarded to Express error middleware via next(err).
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
