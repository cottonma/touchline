import type { Request, Response, NextFunction } from 'express';

/**
 * Token payload shape stored in the base64-encoded token.
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  clubIds: string[];
  exp: number;
}

/**
 * Extends Express Request to include the authenticated user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Decode and validate the base64 token from the Authorization header.
 */
function decodeToken(token: string): TokenPayload | null {
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as TokenPayload;

    // Check required fields
    if (!payload.userId || !payload.email || !payload.role || !payload.exp) {
      return null;
    }

    // Check expiry
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Auth middleware — requires a valid Bearer token.
 * Attaches req.user with the decoded payload.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const payload = decodeToken(token);

  if (!payload) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Admin-only middleware — must be used after authMiddleware.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }
  next();
}
