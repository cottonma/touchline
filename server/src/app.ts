import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { db, sql } from './db/index.js';
import { users, userTeams, clubs, seasons } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-setup: ensure tables exist and admin user is seeded
async function autoSetup() {
  const { readFileSync, readdirSync, existsSync } = await import('fs');
  const migPath = await import('path');
  
  // Run SQL migrations first (creates all base tables)
  const migrationsDir = migPath.join(__dirname, 'db/migrations');
  
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT NOW()::TEXT
    );
  `);

  if (existsSync(migrationsDir)) {
    const applied = await sql.unsafe('SELECT name FROM _migrations ORDER BY id') as { name: string }[];
    const appliedSet = new Set(applied.map((m) => m.name));
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      try {
        const sqlContent = readFileSync(migPath.join(migrationsDir, file), 'utf-8');
        await sql.unsafe(sqlContent);
        await sql.unsafe('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        console.log(`  ✅ Migration applied: ${file}`);
      } catch (err: any) {
        console.error(`  ⚠️ Migration ${file}: ${err.message}`);
      }
    }
  }

  // Create auth tables if they don't exist
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'coach',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_teams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      club_id TEXT NOT NULL REFERENCES clubs(id),
      role TEXT NOT NULL DEFAULT 'coach',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS opposition_notes (
      id TEXT PRIMARY KEY,
      opponent TEXT NOT NULL,
      fixture_id TEXT REFERENCES fixtures(id),
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scout_reports (
      id TEXT PRIMARY KEY,
      fixture_id TEXT REFERENCES fixtures(id),
      opponent TEXT NOT NULL,
      scout_name TEXT,
      date TEXT,
      final_score TEXT,
      formation TEXT,
      style_of_play TEXT,
      key_players TEXT,
      attack_direction TEXT,
      chance_creation TEXT,
      attacking_notes TEXT,
      defensive_style TEXT,
      weaknesses TEXT,
      defensive_notes TEXT,
      corners_rating TEXT,
      gk_rating TEXT,
      gk_distribution TEXT,
      set_piece_notes TEXT,
      threats TEXT,
      opportunities TEXT,
      attack_by TEXT,
      defend_by TEXT,
      confidence_rating TEXT,
      overall_comments TEXT,
      team_performance_rating INTEGER,
      team_strengths TEXT,
      team_weaknesses TEXT,
      team_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Add columns that may be missing (PostgreSQL uses ADD COLUMN IF NOT EXISTS)
  try { await sql.unsafe(`ALTER TABLE seasons ADD COLUMN IF NOT EXISTS formation TEXT`); } catch {}
  try { await sql.unsafe(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS date TEXT`); } catch {}
  try { await sql.unsafe(`ALTER TABLE training_attendance ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES training_sessions(id)`); } catch {}
  try { await sql.unsafe(`ALTER TABLE players ADD COLUMN IF NOT EXISTS tertiary_position TEXT`); } catch {}
  try { await sql.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS player_id TEXT REFERENCES players(id)`); } catch {}
  try { await sql.unsafe(`ALTER TABLE players ADD COLUMN IF NOT EXISTS club_id TEXT REFERENCES clubs(id)`); } catch {}

  // Create motm_votes table for parent MOTM voting
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS motm_votes (
      id TEXT PRIMARY KEY,
      fixture_id TEXT NOT NULL REFERENCES fixtures(id),
      voter_id TEXT NOT NULL REFERENCES users(id),
      player_id TEXT NOT NULL REFERENCES players(id),
      created_at TEXT NOT NULL
    );
  `);

  // Assign orphan players (no clubId) to club_default
  await sql.unsafe(`UPDATE players SET club_id = 'club_default' WHERE club_id IS NULL`);

  // Seed admin user if not exists
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, 'admin@touchline.app')).limit(1);
  if (!existingAdmin) {
    const now = new Date().toISOString();
    const adminId = nanoid();
    const passwordHash = createHash('sha256').update('touchline123').digest('hex');

    await db.insert(users).values({
      id: adminId,
      email: 'admin@touchline.app',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    } as any);

    // Link to club_default if it exists
    const [club] = await db.select().from(clubs).where(eq(clubs.id, 'club_default')).limit(1);
    if (club) {
      await db.insert(userTeams).values({
        id: nanoid(),
        userId: adminId,
        clubId: 'club_default',
        role: 'admin',
        createdAt: now,
      } as any);
    }

    console.log('✅ Admin user seeded: admin@touchline.app');
  }

  // Seed default club and season if not exists
  const [existingClub] = await db.select().from(clubs).where(eq(clubs.id, 'club_default')).limit(1);
  if (!existingClub) {
    const now = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    
    await db.insert(clubs).values({
      id: 'club_default',
      name: 'My Club',
      teamName: 'First Team',
      ageGroup: 'U10',
      createdAt: now,
      updatedAt: now,
    } as any);

    await db.insert(seasons).values({
      id: 'season_default',
      clubId: 'club_default',
      name: `${currentYear}/${currentYear + 1} Season`,
      startDate: `${currentYear}-08-01`,
      endDate: `${currentYear + 1}-06-30`,
      format: '7v7',
      matchDurationMinutes: 48,
      periods: 4,
      maxSquadSize: 12,
      formation: '2-3-1',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as any);

    console.log('✅ Default club and season seeded');
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Touchline API',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Setup all routes
setupRoutes(app);

// Global error handler - MUST be after all routes but before static serving
app.use(errorHandler);

// Serve the built frontend (production mode)
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// All non-API routes serve the frontend (SPA routing)
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Start server
autoSetup().then(() => {
  app.listen(Number(PORT), HOST, () => {
    console.log(`\n⚽ Touchline is running!`);
    console.log(`\n   Open in your browser: http://localhost:${PORT}\n`);
  });
}).catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});

export default app;
