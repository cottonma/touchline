/**
 * Auto-setup: Creates tables and seeds default data on server startup.
 * This ensures Railway (or any fresh deployment) has the required schema and admin user.
 */
import { createHash } from 'crypto';
import { connection } from './index.js';

export function autoSetup() {
  console.log('🔧 Running auto-setup...');

  // Create users table
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
  `);

  // Create user_teams table
  connection.exec(`
    CREATE TABLE IF NOT EXISTS user_teams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      club_id TEXT NOT NULL REFERENCES clubs(id),
      role TEXT NOT NULL DEFAULT 'coach',
      created_at TEXT NOT NULL
    );
  `);

  // Create opposition_notes table
  connection.exec(`
    CREATE TABLE IF NOT EXISTS opposition_notes (
      id TEXT PRIMARY KEY,
      opponent TEXT NOT NULL,
      fixture_id TEXT REFERENCES fixtures(id),
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Add formation column to seasons (if missing)
  try { connection.exec(`ALTER TABLE seasons ADD COLUMN formation TEXT`); } catch {}

  // Add date column to training_sessions (if missing)
  try { connection.exec(`ALTER TABLE training_sessions ADD COLUMN date TEXT`); } catch {}

  // Add session_id to training_attendance (if missing)
  try { connection.exec(`ALTER TABLE training_attendance ADD COLUMN session_id TEXT REFERENCES training_sessions(id)`); } catch {}

  // Add tertiary_position to players (if missing)
  try { connection.exec(`ALTER TABLE players ADD COLUMN tertiary_position TEXT`); } catch {}

  // Seed default club if not exists
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  const existingClub = connection.prepare("SELECT id FROM clubs WHERE id = 'club_default'").get();
  if (!existingClub) {
    connection.prepare(`
      INSERT INTO clubs (id, name, team_name, age_group, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('club_default', 'My Club', 'First Team', 'U10', now, now);
    console.log('  ✅ Default club created');
  }

  // Seed default season if not exists
  const existingSeason = connection.prepare("SELECT id FROM seasons WHERE id = 'season_default'").get();
  if (!existingSeason) {
    connection.prepare(`
      INSERT INTO seasons (id, club_id, name, start_date, end_date, format, match_duration_minutes, periods, max_squad_size, formation, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('season_default', 'club_default', `${currentYear}/${currentYear + 1} Season`, `${currentYear}-08-01`, `${currentYear + 1}-06-30`, '7v7', 48, 4, 12, '2-3-1', 1, now, now);
    console.log('  ✅ Default season created');
  }

  // Seed admin user if not exists
  const existingAdmin = connection.prepare("SELECT id FROM users WHERE email = 'admin@touchline.app'").get();
  if (!existingAdmin) {
    const adminId = `admin_${Date.now()}`;
    const passwordHash = createHash('sha256').update('touchline123').digest('hex');

    connection.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin@touchline.app', passwordHash, 'Admin', 'User', 'admin', now, now);

    // Link admin to club_default
    connection.prepare(`
      INSERT INTO user_teams (id, user_id, club_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(`ut_${Date.now()}`, adminId, 'club_default', 'admin', now);

    console.log('  ✅ Admin user created (admin@touchline.app / touchline123)');
  }

  console.log('🔧 Auto-setup complete.\n');
}
