import { Router } from 'express';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { users, userTeams, clubs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import type { TokenPayload } from '../middleware/auth.js';

export const authRoutes = Router();

/**
 * Hash a password with SHA-256 (MVP — not production-secure).
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Generate a base64-encoded token containing user info.
 */
function generateToken(userId: string, email: string, role: string, clubIds: string[]): string {
  const payload: TokenPayload = {
    userId,
    email,
    role,
    clubIds,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * POST /api/auth/login
 * Authenticate user and return token.
 */
authRoutes.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Email and password are required' });
      return;
    }

    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
      return;
    }

    // Verify password
    const inputHash = hashPassword(password);
    if (inputHash !== user.passwordHash) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
      return;
    }

    // Get user's club associations
    const teams = await db.select().from(userTeams).where(eq(userTeams.userId, user.id));
    const clubIds = teams.map((t) => t.clubId);

    // Generate token
    const token = generateToken(user.id, user.email, user.role, clubIds);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        clubIds,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Return current user info from token.
 */
authRoutes.get('/me', authMiddleware, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const teams = await db.select().from(userTeams).where(eq(userTeams.userId, user.id));
    const clubIds = teams.map((t) => t.clubId);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      clubIds,
    });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/register
 * Create a new user (admin only).
 */
authRoutes.post('/register', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, clubId } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'All fields are required' });
      return;
    }

    // Check if email already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already registered' });
      return;
    }

    const now = new Date().toISOString();
    const userId = nanoid();
    const passwordHash = hashPassword(password);

    const userValues: Record<string, unknown> = {
      id: userId,
      email,
      passwordHash,
      firstName,
      lastName,
      role: role || 'coach',
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(users).values(userValues as any);

    // Link to club if provided
    if (clubId) {
      const teamValues: Record<string, unknown> = {
        id: nanoid(),
        userId,
        clubId,
        role: role || 'coach',
        createdAt: now,
      };
      await db.insert(userTeams).values(teamValues as any);
    }

    res.status(201).json({
      id: userId,
      email,
      firstName,
      lastName,
      role: role || 'coach',
      clubIds: clubId ? [clubId] : [],
    });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Registration failed' });
  }
});

/**
 * GET /api/auth/users
 * List all users with their team associations (admin only).
 */
authRoutes.get('/users', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const { clubs } = await import('../db/schema.js');
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users);

    // Get all user-team associations with club names
    const allUserTeams = await db.select({
      userId: userTeams.userId,
      clubId: userTeams.clubId,
      clubName: clubs.name,
    }).from(userTeams).innerJoin(clubs, eq(userTeams.clubId, clubs.id));

    // Merge team info into user records
    const usersWithTeams = allUsers.map((u) => ({
      ...u,
      teams: allUserTeams
        .filter((t) => t.userId === u.id)
        .map((t) => ({ clubId: t.clubId, clubName: t.clubName })),
    }));

    res.json(usersWithTeams);
  } catch (err) {
    console.error('[auth/users]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch users' });
  }
});

/**
 * GET /api/auth/clubs
 * List all clubs (for team switcher — admin only).
 */
authRoutes.get('/clubs', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const { clubs } = await import('../db/schema.js');
    const allClubs = await db.select().from(clubs);
    res.json(allClubs);
  } catch (err) {
    console.error('[auth/clubs]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch clubs' });
  }
});
