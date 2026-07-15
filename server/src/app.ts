import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { db } from './db/index.js';
import { users, userTeams, clubs, seasons } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-setup: ensure tables exist and admin user is seeded
async function autoSetup() {
  const { connection } = await import('./db/index.js');
  
  // Create auth tables if they don't exist
  connection.exec(`
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
  `);

  // Seed admin user if not exists
  const existingAdmin = db.select().from(users).where(eq(users.email, 'admin@touchline.app')).get();
  if (!existingAdmin) {
    const now = new Date().toISOString();
    const adminId = nanoid();
    const passwordHash = createHash('sha256').update('touchline123').digest('hex');

    db.insert(users).values({
      id: adminId,
      email: 'admin@touchline.app',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    } as any).run();

    // Link to club_default if it exists
    const club = db.select().from(clubs).where(eq(clubs.id, 'club_default')).get();
    if (club) {
      db.insert(userTeams).values({
        id: nanoid(),
        userId: adminId,
        clubId: 'club_default',
        role: 'admin',
        createdAt: now,
      } as any).run();
    }

    console.log('✅ Admin user seeded: admin@touchline.app');
  }

  // Seed default club and season if not exists
  const existingClub = db.select().from(clubs).where(eq(clubs.id, 'club_default')).get();
  if (!existingClub) {
    const now = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    
    db.insert(clubs).values({
      id: 'club_default',
      name: 'My Club',
      teamName: 'First Team',
      ageGroup: 'U10',
      createdAt: now,
      updatedAt: now,
    } as any).run();

    db.insert(seasons).values({
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
    } as any).run();

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
